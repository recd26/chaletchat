import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import {
  loadManualMissions,
  addManualMissions as addToStore,
  deleteManualMission as delFromStore,
} from '../lib/manualMissions'

// Hook léger : expose les missions manuelles/importées d'un pro, stockées
// localement (localStorage) tant qu'on n'a pas de table Supabase dédiée.
// Elles s'affichent dans le calendrier à côté des missions confirmées.
export function useManualMissions() {
  const { user } = useAuth()
  const userId = user?.id || null
  const [missions, setMissions] = useState([])

  useEffect(() => {
    setMissions(loadManualMissions(userId))
  }, [userId])

  const add = useCallback((items) => {
    const next = addToStore(userId, items)
    setMissions(next)
    return next
  }, [userId])

  const remove = useCallback((id) => {
    const next = delFromStore(userId, id)
    setMissions(next)
    return next
  }, [userId])

  return { missions, addManualMissions: add, deleteManualMission: remove }
}
