import { supabase } from './supabase'
import { haversineDistance } from './geocode'

/**
 * Envoie une notification in-app + email
 * Adapté au schéma : notifications(user_id, title, message, type, is_read, data)
 */
export async function sendNotification({ userId, type, title, body, requestId, senderId }) {
  // 1. Notification in-app (insert dans la table)
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message: body,
    data: { request_id: requestId, sender_id: senderId },
  })
  if (error) {
    console.error('Erreur notification insert:', error.message, { userId, type, title })
  }

  // 2. Email via Edge Function
  try {
    await supabase.functions.invoke('send-notification-email', {
      body: { userId, type, title, body, requestId },
    })
  } catch (err) {
    // L'email est un bonus — ne pas bloquer si ça échoue
    console.warn('Email non envoyé:', err.message)
  }
}

/**
 * Notifie tous les pros dans le rayon d'une nouvelle demande.
 * Si le chalet n'a pas de coordonnées, on notifie TOUS les pros (fallback).
 * Les pros sans coordonnées reçoivent aussi les notifications (ils voient tout).
 */
export async function notifyNearbyPros({ request, chalet, senderId }) {
  const chaletHasCoords = chalet?.lat && chalet?.lng
  const chaletName = chalet?.name || 'Chalet'
  const chaletCity = chalet?.city || 'proximité'

  // Récupérer TOUS les pros (avec ou sans coordonnées)
  const { data: pros, error } = await supabase
    .from('profiles')
    .select('id, first_name, lat, lng, radius_km')
    .eq('role', 'pro')

  if (error) {
    console.error('Erreur fetch pros pour notification:', error.message)
    return
  }
  if (!pros?.length) return

  const notifications = []
  for (const pro of pros) {
    // Si le pro ET le chalet ont des coordonnées, vérifier la distance
    if (chaletHasCoords && pro.lat && pro.lng) {
      const dist = haversineDistance(
        { lat: pro.lat, lng: pro.lng },
        { lat: chalet.lat, lng: chalet.lng }
      )
      const radius = pro.radius_km || 25
      if (dist <= radius) {
        notifications.push(
          sendNotification({
            userId: pro.id,
            type: 'new_request_nearby',
            title: 'Nouvelle demande de ménage',
            body: `${chaletName} à ${chaletCity} — ${Math.round(dist)} km de vous`,
            requestId: request.id,
            senderId,
          })
        )
      }
    } else {
      // Pas de coordonnées → notifier quand même (fallback)
      notifications.push(
        sendNotification({
          userId: pro.id,
          type: 'new_request_nearby',
          title: 'Nouvelle demande de ménage',
          body: `${chaletName} à ${chaletCity}`,
          requestId: request.id,
          senderId,
        })
      )
    }
  }

  if (notifications.length > 0) {
    await Promise.allSettled(notifications)
  }
}

/**
 * Notifie le propriétaire quand le ménage est complété
 */
export async function notifyCleaningCompleted({ request, chaletName, proName }) {
  if (!request?.owner_id) return

  await sendNotification({
    userId: request.owner_id,
    type: 'cleaning_completed',
    title: 'Ménage terminé !',
    body: `${proName || 'Le pro'} a complété le ménage de ${chaletName || 'votre chalet'}. Paiement en cours de libération.`,
    requestId: request.id,
    senderId: request.assigned_pro_id,
  })
}
