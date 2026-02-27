import { useState, useRef } from 'react'
import { Upload, CheckCircle } from 'lucide-react'

export default function UploadBox({ icon, title, subtitle, onFile, teal = false }) {
  const [uploaded, setUploaded] = useState(false)
  const [preview,  setPreview]  = useState(null)
  const inputRef = useRef()

  function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploaded(true)
    setPreview(URL.createObjectURL(file))
    onFile?.(file)
  }

  const borderColor = uploaded
    ? 'border-teal bg-teal/5'
    : teal
      ? 'border-dashed border-gray-200 hover:border-teal hover:bg-teal/3'
      : 'border-dashed border-gray-200 hover:border-coral hover:bg-coral/3'

  return (
    <div
      onClick={() => !uploaded && inputRef.current?.click()}
      className={`relative border-2 rounded-xl p-5 text-center transition-all cursor-pointer ${borderColor}`}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      {uploaded && (
        <div className="absolute top-2 right-2 text-teal">
          <CheckCircle size={18} fill="currentColor" className="text-teal" />
        </div>
      )}

      {preview ? (
        <img src={preview} alt="aperçu" className="w-full h-20 object-cover rounded-lg mb-2" />
      ) : (
        <div className="text-3xl mb-2">{icon}</div>
      )}

      <p className="text-sm font-700 text-gray-800 mb-0.5">{uploaded ? `✅ ${title} téléversé·e` : title}</p>
      <p className="text-xs text-gray-400">{uploaded ? 'Cliquez pour remplacer' : subtitle}</p>
    </div>
  )
}
