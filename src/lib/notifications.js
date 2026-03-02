import { supabase } from './supabase'
import { haversineDistance } from './geocode'

/**
 * Envoie une notification in-app + email
 * Schéma : notifications(id, user_id, title, message, type, is_read, data, created_at)
 */
export async function sendNotification({ userId, type, title, body, requestId, senderId }) {
  if (!userId || !title) {
    console.error('sendNotification: userId ou title manquant', { userId, type, title })
    return
  }

  // 1. Notification in-app — essai avec data JSONB, fallback sans
  const row = {
    user_id: userId,
    type: type || 'info',
    title,
    message: body || title,
  }

  // Tenter avec le champ data (JSONB) s'il existe dans la table
  let { error } = await supabase.from('notifications').insert({
    ...row,
    data: { request_id: requestId, sender_id: senderId },
  })

  // Si échec (ex: colonne data inexistante), réessayer sans data
  if (error) {
    console.warn('Notification insert avec data échoué, retry sans data:', error.message)
    const retry = await supabase.from('notifications').insert(row)
    error = retry.error
  }

  if (error) {
    console.error('❌ NOTIFICATION ECHEC FINAL:', error.message, error.details, error.hint, row)
  } else {
    console.log('✅ Notification créée:', type, 'pour', userId)
  }

  // 2. Email via Edge Function
  try {
    await supabase.functions.invoke('send-notification-email', {
      body: { userId, type, title, body, requestId },
    })
  } catch (err) {
    console.warn('Email non envoyé:', err.message)
  }
}

/**
 * Notifie uniquement les pros dont le rayon couvre le chalet.
 * Requiert que le chalet ET le pro aient des coordonnées (lat/lng).
 */
export async function notifyNearbyPros({ request, chalet, senderId }) {
  if (!chalet?.lat || !chalet?.lng) {
    console.warn('notifyNearbyPros: chalet sans coordonnées, aucune notification envoyée')
    return
  }

  const chaletName = chalet?.name || 'Chalet'
  const chaletCity = chalet?.city || 'proximité'

  // Récupérer les pros qui ont des coordonnées
  const { data: pros, error } = await supabase
    .from('profiles')
    .select('id, first_name, lat, lng, radius_km')
    .eq('role', 'pro')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) {
    console.error('Erreur fetch pros pour notification:', error.message)
    return
  }
  if (!pros?.length) {
    console.warn('notifyNearbyPros: aucun pro avec coordonnées trouvé')
    return
  }

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
          body: `${chaletName} à ${chaletCity} — ${Math.round(dist)} km de vous`,
          requestId: request.id,
          senderId,
        })
      )
    }
  }

  console.log(`notifyNearbyPros: ${pros.length} pros trouvés, ${notifications.length} dans le rayon`)

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
