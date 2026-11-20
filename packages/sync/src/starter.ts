/**
 * Starter files for a brand-new room. Created once, after the first server sync,
 * only if the room has no files at all.
 */
import type { CreateFileInput } from './files'

export const STARTER_FILES: readonly CreateFileInput[] = [
  {
    name: 'README.md',
    content: `# Welcome to Hydras

Everyone in this room edits these files live.

- Go offline from the inspector (Ctrl+I) and keep typing.
- Reconnect: your edits merge with everyone else's. Nothing is lost.
- Ctrl+Z only undoes *your* changes.
`,
  },
  {
    name: 'main.ts',
    content: `import { greet } from './utils'

const team = ['ana', 'ravi', 'mei', 'tomas']

for (const name of team) {
  console.log(greet(name))
}
`,
  },
  {
    name: 'utils.ts',
    content: `export function greet(name: string): string {
  return \`hello, \${name}\`
}
`,
  },
]
