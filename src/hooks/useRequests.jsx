import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { haversineDistance } from '../lib/geocode'
import { sendNotification, notifyNearbyPros, notifyCleaningCompleted, notifyMissionEnRoute, notifyMissionSurPlace, notifyMissionStarted } from '../lib/notifications'
import { compressImage } from '../lib/imageUtils'

// Dériver le statut de mission (5 étapes) à partir des timestamps
export function getMissionStatus(req) {
  if (!req || !['confirmed', 'in_progress', 'completed'].includes(req.status)) return null
  if (req.status === 'completed')    return { step: 5, key: 'completed',  label: 'Complété',  icon: '✅', time: req.updated_at }
  if (req.mission_started_at)        return { step: 4, key: 'en_cours',   label: 'En cours',  icon: '🧹', time: req.mission_started_at }
  if (req.mission_sur_place_at)      return { step: 3, key: 'sur_place',  label: 'Sur place', icon: '🏠', time: req.mission_sur_place_at }
  if (req.mission_en_route_at)       return { step: 2, key: 'en_route',   label: 'En route',  icon: '🚗', time: req.mission_en_route_at }
  return { step: 1, key: 'accepted', label: 'Accepté', icon: '🟡', time: req.access_sent_at || req.updated_at }
}

export function useRequests() {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user || !profile) return
    fetchRequests()

    // Unique channel name per hook instance to avoid conflicts
    const channelName = `requests-changes-${user.id}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cleaning_requests',
      }, () => fetchRequests())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'offers',
      }, () => fetchRequests())
      .subscribe()

    channelRef.current = channel

    return () => supabase.removeChannel(channel)
  }, [user, profile])

  async function fetchRequests() {
    setLoading(true)
    try {
      let query = supabase
        .from('cleaning_requests')
        .select(`
          *,
          chalet:chalets(*,
            checklist_templates(*)),
          offers(*,
            pro:profiles(id, first_name, last_name, avatar_url, city, province, lat, lng,
              radius_km, languages, selfie_url, id_card_url, id_verified, verif_status)),
          checklist_completions(*),
          reviews(*)
        `)
        .order('scheduled_date', { ascending: true })

      if (profile.role === 'proprio') {
        query = query.eq('owner_id', user.id)
      } else {
        query = query.or(`status.eq.open,assigned_pro_id.eq.${user.id}`)
      }

      const { data, error } = await query
      if (error) throw error
      setRequests(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function createRequest(payload) {
    const { data, error } = await supabase
      .from('cleaning_requests')
      .insert({ ...payload, owner_id: user.id })
      .select('*, chalet:chalets(*)')
      .single()
    if (error) throw error

    // Notifier les pros dans le rayon
    notifyNearbyPros({
      request: data,
      chalet: data.chalet,
      senderId: user.id,
    })

    await fetchRequests()
    return data
  }

  async function acceptOffer(requestId, offerId, proId, price) {
    // NOTE: RLS empêche le proprio de modifier les offres (seul le pro peut).
    // On ne tente plus de mettre à jour offers.status côté client.
    // Le statut d'acceptation est déduit de cleaning_requests.assigned_pro_id + status='confirmed'.
    // Pour corriger, exécuter dans Supabase SQL Editor :
    //   CREATE POLICY "Owner can update offer status" ON public.offers
    //     FOR UPDATE USING (EXISTS (
    //       SELECT 1 FROM cleaning_requests cr
    //       WHERE cr.id = request_id AND cr.owner_id = auth.uid()
    //     ));

    // 1. Met a jour la demande (le proprio PEUT modifier ses propres demandes)
    const { error } = await supabase.from('cleaning_requests').update({
      assigned_pro_id: proId,
      agreed_price: price,
      status: 'confirmed',
      access_sent_at: new Date().toISOString(),
    }).eq('id', requestId)
    if (error) throw error

    // Notifier le pro accepte
    const request = requests.find(r => r.id === requestId)
    await sendNotification({
      userId: proId,
      type: 'offer_accepted',
      title: 'Offre acceptee !',
      body: `${price} $ — ${request?.chalet?.name || 'Chalet'}`,
      requestId,
      senderId: user.id,
    })

    // Notifier les pros refuses
    const declinedOffers = request?.offers?.filter(o => o.id !== offerId && o.pro_id !== proId) || []
    for (const offer of declinedOffers) {
      await sendNotification({
        userId: offer.pro_id,
        type: 'offer_declined',
        title: 'Offre non retenue',
        body: `Pour ${request?.chalet?.name || 'un chalet'}`,
        requestId,
        senderId: user.id,
      })
    }

    await fetchRequests()
  }

  async function submitOffer(requestId, price, message) {
    const { error } = await supabase.from('offers').upsert({
      request_id: requestId,
      pro_id: user.id,
      price,
      message,
      status: 'pending',
    })
    if (error) throw error

    // Notifier le proprio
    const request = requests.find(r => r.id === requestId)
    if (request?.owner_id) {
      await sendNotification({
        userId: request.owner_id,
        type: 'new_offer',
        title: `Nouvelle offre de ${profile.first_name}`,
        body: `${price} $ pour ${request.chalet?.name || 'votre chalet'}`,
        requestId,
        senderId: user.id,
      })
    }

    await fetchRequests()
  }

  async function updateChecklistItem(requestId, templateId, isDone, photoUrl = null) {
    const { error } = await supabase.from('checklist_completions').upsert(
      {
        request_id: requestId,
        template_id: templateId,
        is_done: isDone,
        photo_url: photoUrl,
        completed_at: isDone ? new Date().toISOString() : null,
      },
      { onConflict: 'request_id,template_id' }
    )
    if (error) throw error
    await fetchRequests()
  }

  async function uploadRoomPhoto(requestId, templateId, file) {
    const compressed = await compressImage(file, 1200, 0.7)
    const path = `${requestId}/${templateId}-${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('cleaning-photos')
      .upload(path, compressed, { upsert: true })
    if (upErr) throw new Error(`Storage: ${upErr.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('cleaning-photos')
      .getPublicUrl(path)

    await updateChecklistItem(requestId, templateId, true, publicUrl)

    // Auto-démarrer la mission (1ère photo = "En cours")
    const req = requests.find(r => r.id === requestId)
    if (req && !req.mission_started_at && ['confirmed', 'in_progress'].includes(req.status)) {
      const now = new Date().toISOString()
      await supabase.from('cleaning_requests')
        .update({ mission_started_at: now, status: 'in_progress', updated_at: now })
        .eq('id', requestId)
        .is('mission_started_at', null)
      notifyMissionStarted({
        request: req,
        chaletName: req.chalet?.name || 'votre chalet',
        proName: profile?.first_name || 'Le professionnel',
      })
    }

    // Vérifier si la checklist est 100% complétée
    if (req) {
      const totalTasks = req.chalet?.checklist_templates?.length || 0
      const completedBefore = req.checklist_completions?.filter(c => c.is_done && c.photo_url)?.length || 0
      // +1 pour la pièce qu'on vient de compléter
      if (totalTasks > 0 && (completedBefore + 1) >= totalTasks) {
        // Marquer la demande comme complétée (filet de sécurité si le trigger DB ne se déclenche pas)
        await supabase.from('cleaning_requests')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', requestId)
          .in('status', ['confirmed', 'in_progress'])

        notifyCleaningCompleted({
          request: req,
          chaletName: req.chalet?.name,
          proName: profile?.first_name,
        })
      }
    }

    return publicUrl
  }

  async function completeRequest(requestId) {
    const req = requests.find(r => r.id === requestId)
    const { error } = await supabase.from('cleaning_requests')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .in('status', ['confirmed', 'in_progress'])
    if (error) throw error

    if (req) {
      notifyCleaningCompleted({
        request: req,
        chaletName: req.chalet?.name,
        proName: profile?.first_name,
      })
    }

    await fetchRequests()
  }

  async function updateMissionStatus(requestId, statusKey) {
    const req = requests.find(r => r.id === requestId)
    if (!req) throw new Error('Demande introuvable')
    const now = new Date().toISOString()
    let updates = {}

    if (statusKey === 'en_route') {
      updates = { mission_en_route_at: now, updated_at: now }
    } else if (statusKey === 'sur_place') {
      updates = { mission_sur_place_at: now, status: 'in_progress', updated_at: now }
    } else {
      throw new Error('Statut invalide')
    }

    const { error } = await supabase.from('cleaning_requests')
      .update(updates)
      .eq('id', requestId)
    if (error) throw error

    // Notifier le proprio
    const chaletName = req.chalet?.name || 'votre chalet'
    const proName = profile?.first_name || 'Le professionnel'
    if (statusKey === 'en_route') {
      notifyMissionEnRoute({ request: req, chaletName, proName })
    } else if (statusKey === 'sur_place') {
      notifyMissionSurPlace({ request: req, chaletName, proName })
    }

    await fetchRequests()
  }

  async function submitReview(requestId, revieweeId, rating, comment) {
    const { error } = await supabase.from('reviews').upsert(
      {
        request_id: requestId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment,
      },
      { onConflict: 'request_id,reviewer_id' }
    )
    if (error) throw error
    await fetchRequests()
  }

  async function updateOffer(offerId, price, message) {
    const { error } = await supabase.from('offers')
      .update({ price, message })
      .eq('id', offerId)
    if (error) throw error
    await fetchRequests()
  }

  async function updateRequest(requestId, updates) {
    const req = requests.find(r => r.id === requestId)
    const existingOffers = req?.offers || []

    // 1. Mettre à jour la demande
    const { error } = await supabase.from('cleaning_requests')
      .update(updates)
      .eq('id', requestId)
    if (error) throw error

    // 2. Supprimer les offres existantes (remet en "En attente d'offres")
    if (existingOffers.length > 0) {
      const { error: delErr } = await supabase.from('offers')
        .delete()
        .eq('request_id', requestId)
      if (delErr) console.warn('Erreur suppression offres:', delErr.message)

      // 3. Notifier chaque pro que leur offre a été retirée
      for (const offer of existingOffers) {
        await sendNotification({
          userId: offer.pro_id,
          type: 'offer_declined',
          title: 'Demande modifiée',
          body: `Le propriétaire a modifié la demande pour ${req?.chalet?.name || 'un chalet'}. Votre offre a été retirée, vous pouvez en soumettre une nouvelle.`,
          requestId,
          senderId: user.id,
        })
      }
    }

    // 4. Re-notifier les pros à proximité de la demande mise à jour
    if (req?.chalet) {
      notifyNearbyPros({
        request: { ...req, id: requestId },
        chalet: req.chalet,
        senderId: user.id,
      })
    }

    await fetchRequests()
  }

  function getOpenRequestsNearby(proProfile) {
    const openReqs = requests.filter(r => r.status === 'open')
    if (!proProfile || proProfile.role !== 'pro' || !proProfile.lat || !proProfile.lng) return openReqs
    const radiusKm = proProfile.radius_km || 25
    return openReqs.filter(req => {
      if (!req.chalet?.lat || !req.chalet?.lng) return true
      const dist = haversineDistance(
        { lat: proProfile.lat, lng: proProfile.lng },
        { lat: req.chalet.lat, lng: req.chalet.lng }
      )
      return dist <= radiusKm
    })
  }

  return { requests, loading, createRequest, acceptOffer, submitOffer, submitReview, completeRequest, updateMissionStatus, updateChecklistItem, uploadRoomPhoto, updateOffer, updateRequest, getOpenRequestsNearby, refetch: fetchRequests }
}
