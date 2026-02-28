import { useState, useRef, useEffect } from 'react'
import { Bell, Check, MessageSquare, DollarSign, CheckCircle, XCircle, MapPin, Sparkles } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

const ICON_MAP = {
  new_offer:           { icon: DollarSign,   color: 'text-coral' },
  offer_accepted:      { icon: CheckCircle,  color: 'text-teal' },
  offer_declined:      { icon: XCircle,      color: 'text-gray-400' },
  new_message:         { icon: MessageSquare, color: 'text-blue-500' },
  new_request_nearby:  { icon: MapPin,       color: 'text-teal' },
  cleaning_completed:  { icon: Sparkles,     color: 'text-green-500' },
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const { toasts, toast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const prevLenRef = useRef(notifications.length)

  // Fermer au clic exterieur
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Toast quand nouvelle notification arrive en temps reel
  useEffect(() => {
    if (notifications.length > prevLenRef.current && notifications.length > 0) {
      const newest = notifications[0]
      if (newest?.title) {
        toast(newest.title, newest.type === 'new_offer' ? 'info' : 'success')
      }
    }
    prevLenRef.current = notifications.length
  }, [notifications.length])

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'maintenant'
    if (mins < 60) return `il y a ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `il y a ${hours}h`
    return `il y a ${Math.floor(hours / 24)}j`
  }

  function handleClickNotif(notif) {
    if (!notif.read_at) markAsRead(notif.id)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-all"
      >
        <Bell size={20} className="text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-coral text-white text-[10px] font-800 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-700 text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-600 text-teal hover:underline flex items-center gap-1"
              >
                <Check size={12} /> Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Aucune notification
              </div>
            ) : (
              notifications.slice(0, 20).map(notif => {
                const { icon: Icon, color } = ICON_MAP[notif.type] || ICON_MAP.new_message
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-all border-b border-gray-50 ${
                      !notif.read_at ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className={`mt-0.5 ${color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 text-gray-800 truncate">{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-gray-400 truncate">{notif.body}</p>
                      )}
                      <p className="text-[11px] text-gray-300 mt-0.5">{timeAgo(notif.created_at)}</p>
                    </div>
                    {!notif.read_at && (
                      <div className="w-2 h-2 bg-coral rounded-full mt-2 flex-shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
