import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { haversineDistance } from '../lib/geocode'
import { sendNotification, notifyNearbyPros, notifyCleaningCompleted } from '../lib/notifications'

export function useRequests() {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user || !profile) return
    fetchRequests()

    // Realtime updates
    const channel = supabase
      .channel('requests-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cleaning_requests',
      }, () => fetchRequests())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, profile])

  async function fetchRequests() {
    setLoading(true)
    try {
      let query = supabase
        .from('cleaning_requests')
        .select(`
          *,
          chalet:chalets(*, checklist_templates(*)),
          offers(*,pro:profiles(*)),
          checklist_completions(*)
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
    // 1. Accepte l'offre
    await supabase.from('offers').update({ status: 'accepted' }).eq('id', offerId)
    // 2. Refuse les autres offres
    await supabase.from('offers').update({ status: 'declined' })
      .eq('request_id', requestId).neq('id', offerId)
    // 3. Met a jour la demande
    const { error } = await supabase.from('cleaning_requests').update({
      assigned_pro_id: proId,
      agreed_price: price,
      status: 'confirmed',
      access_sent_at: new Date().toISOString(),
    }).eq('id', requestId)
    if (error) throw error

    // Notifier le pro accepte
    const request = requests.find(r => r.id === requestId)
    sendNotification({
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
      sendNotification({
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
      sendNotification({
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
    const { error } = await supabase.from('checklist_completions').upsert({
      request_id: requestId,
      template_id: templateId,
      is_done: isDone,
      photo_url: photoUrl,
      completed_at: isDone ? new Date().toISOString() : null,
    })
    if (error) throw error
    await fetchRequests()
  }

  async function uploadRoomPhoto(requestId, templateId, file) {
    const path = `${requestId}/${templateId}-${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('cleaning-photos')
      .upload(path, file, { upsert: true })
    if (upErr) throw upErr

    const { data: { publicUrl } } = supabase.storage
      .from('cleaning-photos')
      .getPublicUrl(path)

    await updateChecklistItem(requestId, templateId, true, publicUrl)

    // Vérifier si la checklist est 100% complétée
    const req = requests.find(r => r.id === requestId)
    if (req) {
      const totalTasks = req.chalet?.checklist_templates?.length || 0
      const completedBefore = req.checklist_completions?.filter(c => c.is_done && c.photo_url)?.length || 0
      // +1 pour la pièce qu'on vient de compléter
      if (totalTasks > 0 && (completedBefore + 1) >= totalTasks) {
        notifyCleaningCompleted({
          request: req,
          chaletName: req.chalet?.name,
          proName: profile?.first_name,
        })
      }
    }

    return publicUrl
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

  return { requests, loading, createRequest, acceptOffer, submitOffer, updateChecklistItem, uploadRoomPhoto, getOpenRequestsNearby, refetch: fetchRequests }
}
