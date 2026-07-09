import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'ChaletProp <notifications@chaletprop.com>'
const APP_URL = Deno.env.get('APP_URL') || 'https://chaletchat.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EmailPayload = {
  userId: string
  type: string
  title?: string
  body?: string
  requestId?: string
  role?: 'pro' | 'proprio'
  reason?: string | null
}

// Templates d'email par type de notification
function getEmailContent(
  type: string,
  title: string,
  body: string,
  firstName: string,
  role?: string,
  reason?: string | null,
): { subject: string; html: string } {
  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 560px; margin: 0 auto; padding: 32px 24px;
  `
  const btnStyle = `
    display: inline-block; padding: 12px 28px; border-radius: 10px;
    font-weight: 700; text-decoration: none; font-size: 14px; margin-top: 16px;
  `

  const colors: Record<string, { accent: string; bg: string; emoji: string }> = {
    new_request_nearby:  { accent: '#0D9488', bg: '#F0FDFA', emoji: '🏔' },
    new_offer:           { accent: '#FF5A5F', bg: '#FFF5F5', emoji: '💰' },
    offer_accepted:      { accent: '#0D9488', bg: '#F0FDFA', emoji: '✅' },
    offer_declined:      { accent: '#6B7280', bg: '#F9FAFB', emoji: '❌' },
    cleaning_completed:  { accent: '#0D9488', bg: '#F0FDFA', emoji: '🎉' },
    new_message:         { accent: '#3B82F6', bg: '#EFF6FF', emoji: '💬' },
    account_approved:    { accent: '#0D9488', bg: '#F0FDFA', emoji: '🎉' },
    account_rejected:    { accent: '#EF4444', bg: '#FEF2F2', emoji: '📋' },
  }

  const c = colors[type] || colors.new_message

  const dashboardPath = role === 'proprio' ? '/dashboard' : '/pro'

  const ctaText: Record<string, string> = {
    new_request_nearby:  'Voir la demande',
    new_offer:           'Voir les offres',
    offer_accepted:      'Voir ma mission',
    cleaning_completed:  'Voir le résultat',
    new_message:         'Lire le message',
    account_approved:    role === 'proprio' ? 'Accéder à mon tableau de bord' : 'Accéder à mon espace pro',
    account_rejected:    'Corriger mon profil',
  }

  const ctaLink: Record<string, string> = {
    account_approved: `${APP_URL}${dashboardPath}`,
    account_rejected: `${APP_URL}/en-attente`,
  }

  // Templates spécifiques account_approved / account_rejected
  if (type === 'account_approved') {
    const html = `
      <div style="${baseStyle}">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 40px;">${c.emoji}</span>
        </div>
        <div style="background: ${c.bg}; border: 1px solid ${c.accent}22; border-radius: 16px; padding: 24px;">
          <p style="margin: 0 0 4px; font-size: 14px; color: #6B7280;">Bonjour ${firstName},</p>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">Bienvenue sur ChaletProp !</h2>
          <p style="margin: 0 0 8px; font-size: 15px; color: #374151; line-height: 1.5;">
            Votre compte a été approuvé par notre équipe. Vous pouvez maintenant
            ${role === 'proprio' ? 'publier vos demandes de ménage et gérer vos chalets.' : 'recevoir les demandes de ménage dans votre zone et faire des offres.'}
          </p>
          <a href="${ctaLink.account_approved}" style="${btnStyle} background: ${c.accent}; color: white;">
            ${ctaText.account_approved}
          </a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 24px;">
          ChaletProp — Ménage professionnel pour chalets locatifs
        </p>
      </div>
    `
    return { subject: `${c.emoji} Bienvenue sur ChaletProp !`, html }
  }

  if (type === 'account_rejected') {
    const reasonBlock = reason
      ? `
        <div style="background: #FEF2F2; border-left: 3px solid ${c.accent}; border-radius: 8px; padding: 12px 14px; margin: 12px 0;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;">
            Motif du refus
          </p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5; white-space: pre-wrap;">${reason}</p>
        </div>
      `
      : `
        <p style="margin: 12px 0; font-size: 14px; color: #6B7280; line-height: 1.5;">
          Notre équipe n'a pas pu valider votre dossier en l'état.
        </p>
      `

    const html = `
      <div style="${baseStyle}">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 40px;">${c.emoji}</span>
        </div>
        <div style="background: ${c.bg}; border: 1px solid ${c.accent}22; border-radius: 16px; padding: 24px;">
          <p style="margin: 0 0 4px; font-size: 14px; color: #6B7280;">Bonjour ${firstName},</p>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">Votre compte n'a pas été approuvé</h2>
          <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.5;">
            Merci pour votre intérêt envers ChaletProp. Voici les prochaines étapes&nbsp;:
          </p>
          ${reasonBlock}
          <p style="margin: 0 0 4px; font-size: 14px; color: #374151; line-height: 1.5;">
            Vous pouvez corriger votre profil et soumettre à nouveau votre vérification.
          </p>
          <a href="${ctaLink.account_rejected}" style="${btnStyle} background: ${c.accent}; color: white;">
            ${ctaText.account_rejected}
          </a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 24px;">
          ChaletProp — Une question ? Répondez à ce courriel.
        </p>
      </div>
    `
    return { subject: `${c.emoji} Suivi de votre inscription ChaletProp`, html }
  }

  // Template générique (in-app existant)
  const html = `
    <div style="${baseStyle}">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 40px;">${c.emoji}</span>
      </div>
      <div style="background: ${c.bg}; border: 1px solid ${c.accent}22; border-radius: 16px; padding: 24px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #6B7280;">Bonjour ${firstName},</p>
        <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">${title}</h2>
        <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.5;">${body}</p>
        <a href="${APP_URL}" style="${btnStyle} background: ${c.accent}; color: white;">
          ${ctaText[type] || 'Ouvrir ChaletProp'}
        </a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 24px;">
        ChaletProp — Ménage professionnel pour chalets locatifs
      </p>
    </div>
  `

  return { subject: `${c.emoji} ${title}`, html }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = (await req.json()) as EmailPayload
    const { userId, type, title, body, role: payloadRole, reason } = payload

    if (!userId || !type) {
      return new Response(
        JSON.stringify({ error: 'userId and type required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer l'email, le prénom et le rôle de l'utilisateur via le service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, role')
      .eq('id', userId)
      .single()

    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstName = profile?.first_name || 'utilisateur'
    const role = payloadRole || profile?.role
    const resolvedTitle = title || (
      type === 'account_approved' ? 'Bienvenue sur ChaletProp !' :
      type === 'account_rejected' ? 'Votre compte n\'a pas été approuvé' :
      'Notification ChaletProp'
    )

    const emailContent = getEmailContent(type, resolvedTitle, body || '', firstName, role, reason)

    // Envoyer via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    })

    const result = await res.json()

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
