import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useMessages(requestId) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !requestId) return
    fetchMessages()

    const channel = supabase
      .channel(`messages-${requestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `request_id=eq.${requestId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        // Marquer comme lu si on n'est pas l'envoyeur
        if (payload.new.sender_id !== user.id) {
          supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', payload.new.id)
            .then()
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, requestId])

  async function fetchMessages() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(first_name, last_name, role)')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(data)

      // Marquer les non-lus comme lus
      const unread = data.filter(m => !m.read_at && m.sender_id !== user.id)
      if (unread.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unread.map(m => m.id))
      }
    } catch (err) {
      console.error('Erreur messages:', err)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(content) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        request_id: requestId,
        sender_id: user.id,
        content,
      })
      .select('*, sender:profiles!sender_id(first_name, last_name, role)')
      .single()
    if (error) throw error

    setMessages(prev => {
      if (prev.find(m => m.id === data.id)) return prev
      return [...prev, data]
    })

    // Creer une notification pour l'autre partie
    const { data: request } = await supabase
      .from('cleaning_requests')
      .select('owner_id, assigned_pro_id, chalet:chalets(name)')
      .eq('id', requestId)
      .single()

    if (request) {
      const recipientId = request.owner_id === user.id
        ? request.assigned_pro_id
        : request.owner_id
      if (recipientId) {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'new_message',
          title: 'Nouveau message',
          body: content.length > 80 ? content.substring(0, 80) + '...' : content,
          request_id: requestId,
          sender_id: user.id,
        })
      }
    }

    return data
  }

  const unreadCount = messages.filter(m => !m.read_at && m.sender_id !== user?.id).length

  return { messages, loading, sendMessage, unreadCount, refetch: fetchMessages }
}
