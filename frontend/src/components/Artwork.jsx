import { Music } from 'lucide-react'
import { initials } from '../utils/format'

export default function Artwork({ imageUrl, title, className = '', compact = false }) {
  return (
    <div className={`artwork ${compact ? 'artwork--compact' : ''} ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" />
      ) : (
        <div className="artwork__fallback">
          <Music size={compact ? 16 : 28} />
          <span>{initials(title)}</span>
        </div>
      )}
    </div>
  )
}
