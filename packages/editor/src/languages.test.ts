import { describe, expect, it } from 'vitest'
import { languageId, loadLanguage } from './languages'

describe('languageId', () => {
  it('maps the languages the editor highlights and ignores the rest', () => {
    expect(languageId('app.TSX')).toBe('tsx')
    expect(languageId('notes.md')).toBe('md')
    expect(languageId('main.py')).toBe('py')
    expect(languageId('data.json')).toBe('json')
    expect(languageId('Makefile')).toBeNull()
    expect(languageId('no-extension')).toBeNull()
  })

  it('loads a grammar for a known file and nothing for plain text', async () => {
    expect(await loadLanguage('readme')).toEqual([])
    const markdown = await loadLanguage('readme.md')
    expect(markdown).not.toEqual([])
  })
})
