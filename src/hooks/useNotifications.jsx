import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read_at).length

  useEffect(() => {
    if (!user) return
    fetchNotifications()

    // Unique channel name per instance to avoid conflicts
    const channelName = `notifications-${user.id}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    channelRef.current = channel

    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchNotifications() {
    setLoading(true)
    try {
      // Pas de join sender — la colonne sender_id n'existe pas dans la table
      // Les infos sender sont dans data.sender_id si besoin
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Erreur notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', notificationId)
    if (error) throw error
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read_at: now } : n)
    )
  }

  async function markAllAsRead() {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)
    if (error) throw error
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: now }))
    )
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
