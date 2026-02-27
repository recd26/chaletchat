export default function Toast({ toasts }) {
  const colors = {
    default: 'bg-gray-900 text-white',
    success: 'bg-green-700 text-white',
    error:   'bg-coral text-white',
    info:    'bg-teal text-white',
  }

  return (
    <div className="fixed bottom-7 left-1/2 z-[999] flex flex-col gap-2 pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-enter px-5 py-3 rounded-full text-sm font-600 shadow-lg whitespace-nowrap ${colors[t.type] || colors.default}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
