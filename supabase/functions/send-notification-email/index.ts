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

// Templates d'email par type de notification
function getEmailContent(type: string, title: string, body: string, firstName: string): { subject: string; html: string } {
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
  }

  const c = colors[type] || colors.new_message

  const ctaText: Record<string, string> = {
    new_request_nearby:  'Voir la demande',
    new_offer:           'Voir les offres',
    offer_accepted:      'Voir ma mission',
    cleaning_completed:  'Voir le résultat',
    new_message:         'Lire le message',
  }

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

    const { userId, type, title, body } = await req.json()

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: 'userId and title required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer l'email et le prénom de l'utilisateur via le service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
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
    const emailContent = getEmailContent(type, title, body || '', firstName)

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
