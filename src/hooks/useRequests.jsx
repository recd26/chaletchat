import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

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
          chalet:chalets(*),
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
      .select()
      .single()
    if (error) throw error
    await fetchRequests()
    return data
  }

  async function acceptOffer(requestId, offerId, proId, price) {
    // 1. Accepte l'offre
    await supabase.from('offers').update({ status: 'accepted' }).eq('id', offerId)
    // 2. Refuse les autres offres
    await supabase.from('offers').update({ status: 'declined' })
      .eq('request_id', requestId).neq('id', offerId)
    // 3. Met à jour la demande
    const { error } = await supabase.from('cleaning_requests').update({
      assigned_pro_id: proId,
      agreed_price: price,
      status: 'confirmed',
      access_sent_at: new Date().toISOString(),
    }).eq('id', requestId)
    if (error) throw error
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
    return publicUrl
  }

  return { requests, loading, createRequest, acceptOffer, submitOffer, updateChecklistItem, uploadRoomPhoto, refetch: fetchRequests }
}
