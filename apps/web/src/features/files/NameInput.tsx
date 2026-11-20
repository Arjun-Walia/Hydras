/** Inline file-name field: Enter submits, Escape or blur-with-no-change cancels. */
import { useState, type KeyboardEvent } from 'react'

type Props = {
  initial: string
  placeholder?: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function NameInput({ initial, placeholder, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initial)

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed === initial) onCancel()
    else onSubmit(trimmed)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    // The new file's editor takes focus synchronously; without this the same Enter
    // would also land in it as a newline.
    event.preventDefault()
    if (event.key === 'Enter') commit()
    else onCancel()
  }

  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      maxLength={128}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      onFocus={(event) => {
        const dot = event.target.value.lastIndexOf('.')
        event.target.setSelectionRange(0, dot > 0 ? dot : event.target.value.length)
      }}
      className="h-7 w-full rounded-[var(--radius-chrome)] border border-accent bg-bg px-2 text-[12.5px] text-fg outline-none placeholder:text-faint"
      aria-label="File name"
    />
  )
}
