import { useState, useRef, useEffect } from 'react'
import { X, Send, MessageSquare } from 'lucide-react'
import { useMessages } from '../hooks/useMessages'
import { useAuth } from '../hooks/useAuth'

export default function ChatPanel({ requestId, chaletName, onClose }) {
  const { user } = useAuth()
  const { messages, loading, sendMessage } = useMessages(requestId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()

  // Auto-scroll vers le bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col chat-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-teal" />
            <div>
              <h3 className="text-sm font-700 text-gray-900">Conversation</h3>
              <p className="text-xs text-gray-400">{chaletName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-all">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-300 text-2xl">...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
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
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-gray-200 flex gap-2">
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
    </>
  )
}
