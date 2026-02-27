export default function StepIndicator({ steps, current, teal = false }) {
  const activeColor = teal ? 'bg-teal border-teal' : 'bg-coral border-coral'
  const doneColor   = 'bg-teal border-teal'

  return (
    <div className="flex items-start mb-7">
      {steps.map((label, i) => {
        const n     = i + 1
        const done  = n < current
        const active= n === current

        return (
          <div key={n} className="flex-1 flex flex-col items-center relative">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="absolute top-3 left-1/2 right-0 h-0.5 -z-0"
                style={{ backgroundColor: done ? '#00A699' : '#EBEBEB' }} />
            )}
            {/* Dot */}
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-800 z-10
              ${done   ? `${doneColor} text-white` : ''}
              ${active ? `${activeColor} text-white` : ''}
              ${!done && !active ? 'bg-white border-gray-200 text-gray-400' : ''}
            `}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs mt-1.5 ${active || done ? 'text-gray-800 font-600' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
