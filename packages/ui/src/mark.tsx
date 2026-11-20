/**
 * The Hydras logo: five low-poly serpent heads (assets/brand/logo.svg, served from the
 * web app's public folder). `size` is the rendered height; width follows the artwork.
 */
export const HYDRAS_LOGO_SRC = '/logo.svg'

/** Width / height of the logo artwork. */
const LOGO_ASPECT = 1808 / 1624

export function HydrasMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <img
      src={HYDRAS_LOGO_SRC}
      alt=""
      aria-hidden="true"
      width={Math.round(size * LOGO_ASPECT)}
      height={size}
      draggable={false}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0 }}
    />
  )
}
