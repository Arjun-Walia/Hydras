/**
 * Collaborator avatars: initials on the person's palette color, stacked with overlap.
 */
import type { CSSProperties } from 'react'
import { cn } from './cn'

export interface AvatarPerson {
  key: string | number
  name: string
  color: string
  isSelf?: boolean
}

function initials(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : name.slice(0, 2)
  return letters.toUpperCase()
}

interface AvatarProps {
  person: AvatarPerson
  size?: number
  className?: string
}

export function Avatar({ person, size = 24, className }: AvatarProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    background: person.color,
    fontSize: Math.round(size * 0.4),
  }
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight text-[var(--accent-ink)] ring-2 ring-[var(--bg)] select-none',
        className,
      )}
      style={style}
      title={person.isSelf ? `${person.name} (you)` : person.name}
    >
      {initials(person.name)}
    </span>
  )
}

interface AvatarStackProps {
  people: readonly AvatarPerson[]
  max?: number
  onSelect?: (person: AvatarPerson) => void
}

export function AvatarStack({ people, max = 5, onSelect }: AvatarStackProps) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length
  return (
    <div
      className="flex items-center -space-x-1.5"
      role="group"
      aria-label="Collaborators in this room"
    >
      {shown.map((person) => {
        const label = person.isSelf ? `${person.name} (you)` : person.name
        return onSelect ? (
          <button
            key={person.key}
            type="button"
            className="rounded-full transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={() => onSelect(person)}
            aria-label={label}
          >
            <Avatar person={person} />
          </button>
        ) : (
          <span key={person.key} aria-label={label}>
            <Avatar person={person} />
          </span>
        )
      })}
      {overflow > 0 && (
        <span
          className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-[var(--surface-raised)] px-1.5 text-[10px] font-semibold text-[var(--muted)] tabular-nums ring-2 ring-[var(--bg)]"
          aria-label={`${overflow} more collaborators`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
