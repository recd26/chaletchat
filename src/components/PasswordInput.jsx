import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

function getStrength(pw) {
  let s = 0
  if (pw.length >= 8)           s++
  if (/[A-Z]/.test(pw))         s++
  if (/[0-9]/.test(pw))         s++
  if (/[^A-Za-z0-9]/.test(pw))  s++
  return s
}

const labels = ['', 'Trop court', 'Faible', 'Bon', 'Fort 💪']
const colors = ['', '#FF5A5F', '#FF9100', '#FFBA5A', '#00A699']
const widths  = ['0%', '25%', '50%', '75%', '100%']

export default function PasswordInput({ id, placeholder, value, onChange, teal = false }) {
  const [show, setShow] = useState(false)
  const s = value ? getStrength(value) : 0

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder || 'Minimum 8 caractères'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={teal ? 'input-field-teal pr-11' : 'input-field pr-11'}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {value && (
        <>
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: widths[s], backgroundColor: colors[s] }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: colors[s] || '#767676' }}>
            {labels[s]}
          </p>
        </>
      )}
    </div>
  )
}
