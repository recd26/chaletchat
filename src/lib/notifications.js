import { supabase } from './supabase'
import { haversineDistance } from './geocode'

/**
 * Envoie une notification in-app + email
 */
export async function sendNotification({ userId, type, title, body, requestId, senderId }) {
  // 1. Notification in-app (insert dans la table)
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    request_id: requestId,
    sender_id: senderId,
  })

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
 * Notifie tous les pros dans le rayon d'une nouvelle demande
 */
export async function notifyNearbyPros({ request, chalet, senderId }) {
  if (!chalet?.lat || !chalet?.lng) return

  // Récupérer tous les pros avec coordonnées
  const { data: pros } = await supabase
    .from('profiles')
    .select('id, first_name, lat, lng, radius_km')
    .eq('role', 'pro')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (!pros?.length) return

  const notifications = []
  for (const pro of pros) {
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
          body: `${chalet.name || 'Chalet'} à ${chalet.city || 'proximité'} — ${Math.round(dist)} km de vous`,
          requestId: request.id,
          senderId,
        })
      )
    }
  }

  await Promise.allSettled(notifications)
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
