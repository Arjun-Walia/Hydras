/**
 * The recorded walkthrough, played from the landing page. The file is copied from
 * docs/demo.mp4 at dev and build time, and it is fetched only while this dialog is open.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../../app/settings-store'

export function DemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="demo-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="m-auto w-[min(960px,calc(100vw-32px))] overflow-hidden rounded-2xl border-0 bg-neutral-950 p-0 text-white shadow-[0_30px_80px_-24px_rgb(0_0_0/0.7)] backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 id="demo-title" className="text-sm font-medium">
          Hydras demo
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close demo"
          className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      {open && (
        <video
          src="/landing/demo.mp4"
          controls
          playsInline
          autoPlay={!reduceMotion}
          className="aspect-video w-full bg-black"
        />
      )}
    </dialog>
  )
}
