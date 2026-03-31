import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRequests } from '../hooks/useRequests'
import { useMessages } from '../hooks/useMessages'
import { MessageSquare, Send, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Panneau de chat inline (pas le slide-in) ─────────────────
function InlineChat({ requestId, chaletName }) {
  const { user } = useAuth()
  const { messages, loading, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  // Auto-scroll
  useEffect(() => {
    const el = document.getElementById('chat-bottom')
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(text.trim())
      setText('')
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <h3 className="font-700 text-gray-900 text-sm">{chaletName}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-300 text-2xl">...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun message encore</p>
            <p className="text-xs text-gray-300 mt-1">Envoyez le premier message</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === user.id
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMine
                    ? 'bg-teal text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {!isMine && msg.sender && (
                    <p className="text-[11px] font-700 text-gray-500 mb-0.5">
                      {msg.sender.first_name}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-gray-300'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div id="chat-bottom" />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-gray-200 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Votre message..."
          className="input-field flex-1"
          autoFocus
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="btn-teal px-4 py-3 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}

// ── Page Messages (style Airbnb) ──────────────────────────────
export default function Messages() {
  const { user, profile } = useAuth()
  const { requests, loading: loadReqs } = useRequests()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(null)
  const [lastMessages, setLastMessages] = useState({})

  const isPro = profile?.role === 'pro'

  // Conversations = demandes confirmées/en cours/complétées
  const conversations = requests.filter(r =>
    ['confirmed', 'in_progress', 'completed'].includes(r.status) &&
    r.assigned_pro_id &&
    (isPro ? r.assigned_pro_id === user.id : r.owner_id === user.id)
  ).sort((a, b) => new Date(b.updated_at || b.scheduled_date) - new Date(a.updated_at || a.scheduled_date))

  // Charger le dernier message de chaque conversation
  useEffect(() => {
    if (conversations.length === 0) return
    async function fetchLastMessages() {
      const ids = conversations.map(c => c.id)
      const { data } = await supabase
        .from('messages')
        .select('request_id, content, sender_id, created_at')
        .in('request_id', ids)
        .order('created_at', { ascending: false })
      if (!data) return
      // Garder uniquement le dernier message par request_id
      const map = {}
      for (const msg of data) {
        if (!map[msg.request_id]) map[msg.request_id] = msg
      }
      setLastMessages(map)
    }
    fetchLastMessages()
  }, [conversations.length])

  // Ouvrir la conversation depuis ?chat=xxx
  useEffect(() => {
    const chatId = searchParams.get('chat')
    if (chatId) {
      setSelectedId(chatId)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const selected = conversations.find(c => c.id === selectedId)

  function getContactName(req) {
    if (isPro) return req.chalet?.name || 'Propriétaire'
    const pro = req.offers?.find(o => o.pro_id === req.assigned_pro_id)?.pro
    return pro ? `${pro.first_name} ${pro.last_name || ''}` : 'Professionnel·le'
  }

  function getContactAvatar(req) {
    if (isPro) return null
    const pro = req.offers?.find(o => o.pro_id === req.assigned_pro_id)?.pro
    return pro?.avatar_url || null
  }

  function getStatusBadge(req) {
    if (req.status === 'completed') return { label: '✅ Terminé', cls: 'bg-gray-100 text-gray-500' }
    if (req.status === 'in_progress') return { label: '🧹 En cours', cls: 'bg-teal/10 text-teal' }
    return { label: '🟡 Confirmé', cls: 'bg-amber-50 text-amber-600' }
  }

  // ── Mobile : si une conversation est sélectionnée, montrer le chat ──
  if (selectedId && selected) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col md:hidden">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 text-sm font-600 text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={16} /> Retour aux conversations
        </button>
        <div className="flex-1">
          <InlineChat requestId={selectedId} chaletName={getContactName(selected)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* ── Sidebar : liste des conversations ── */}
      <div className={`w-full md:w-96 md:border-r border-gray-200 flex flex-col bg-white flex-shrink-0 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-800 text-gray-900">💬 Messages</h1>
          <p className="text-xs text-gray-400 mt-0.5">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadReqs ? (
            <div className="text-center py-12 text-2xl">⏳</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16 px-6">
              <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="font-700 text-gray-500">Aucune conversation</p>
              <p className="text-sm text-gray-400 mt-1">
                {isPro
                  ? 'Vos conversations apparaîtront ici quand une de vos offres sera acceptée.'
                  : 'Vos conversations apparaîtront ici quand vous accepterez une offre.'
                }
              </p>
            </div>
          ) : (
            conversations.map(req => {
              const name = getContactName(req)
              const avatar = getContactAvatar(req)
              const badge = getStatusBadge(req)
              const last = lastMessages[req.id]
              const isActive = selectedId === req.id

              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                  className={`flex items-center gap-3 px-5 py-4 cursor-pointer border-b border-gray-100 transition-all ${
                    isActive ? 'bg-teal/5 border-l-4 border-l-teal' : 'hover:bg-gray-50'
                  }`}
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0 border-2 border-gray-200" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0 text-base">
                      {isPro ? '🏔' : '🧹'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-700 text-gray-900 text-sm truncate">{name}</p>
                      {last && (
                        <span className="text-[10px] text-gray-300 flex-shrink-0">
                          {new Date(last.created_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {isPro ? `${req.chalet?.city || ''} — ` : `🏔 ${req.chalet?.name || ''} — `}
                      {req.agreed_price} $
                    </p>
                    {last ? (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {last.sender_id === user.id ? 'Vous : ' : ''}{last.content}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic mt-0.5">Aucun message</p>
                    )}
                  </div>
                  <span className={`text-[9px] font-700 px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Zone de chat (desktop) ── */}
      <div className="hidden md:flex flex-1 flex-col">
        {selected ? (
          <InlineChat requestId={selectedId} chaletName={getContactName(selected)} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="text-gray-200 mx-auto mb-4" />
              <p className="font-700 text-gray-400">Sélectionnez une conversation</p>
              <p className="text-sm text-gray-300 mt-1">Choisissez une conversation dans la liste pour commencer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
