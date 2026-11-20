/**
 * Structured one-line logs (JSON) so room lifecycle is greppable in container logs.
 */
export function log(event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), event, ...fields })}\n`)
}
