import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useChalets() {
  const { user } = useAuth()
  const [chalets,  setChalets]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!user) return
    fetchChalets()
  }, [user])

  async function fetchChalets() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('chalets')
        .select('*, checklist_templates(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setChalets(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function createChalet(payload) {
    const { data, error } = await supabase
      .from('chalets')
      .insert({ ...payload, owner_id: user.id })
      .select()
      .single()
    if (error) throw error
    setChalets(prev => [data, ...prev])
    return data
  }

  async function updateChalet(id, updates) {
    const { data, error } = await supabase
      .from('chalets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setChalets(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function uploadReferencePhoto(chaletId, file) {
    const ext = file.name?.split('.').pop() || 'jpg'
    const path = `chalets/${chaletId}/ref-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('cleaning-photos')
      .upload(path, file, { upsert: true })
    if (upErr) throw new Error(`Storage: ${upErr.message}`)
    const { data: { publicUrl } } = supabase.storage
      .from('cleaning-photos')
      .getPublicUrl(path)
    return publicUrl
  }

  async function saveChecklistTemplate(chaletId, rooms) {
    // rooms = [{ name: string, photoUrl: string | null }] ou string[]
    await supabase.from('checklist_templates').delete().eq('chalet_id', chaletId)
    const rows = rooms.map((room, i) => {
      if (typeof room === 'string') return { chalet_id: chaletId, room_name: room, position: i }
      return { chalet_id: chaletId, room_name: room.name, reference_photo_url: room.photoUrl || null, position: i }
    })
    const { error } = await supabase.from('checklist_templates').insert(rows)
    if (error) throw error
    await fetchChalets()
  }

  return { chalets, loading, error, createChalet, updateChalet, saveChecklistTemplate, uploadReferencePhoto, refetch: fetchChalets }
}
