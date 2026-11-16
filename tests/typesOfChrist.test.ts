import { describe, expect, it } from 'vitest'
import { parseParagraph, passagesIn, passageTitle, passageUrl } from '../shared/utils/typesOfChrist'

describe('parseParagraph', () => {
  it('splits text, bold and references, keeping every character of the text', () => {
    expect(parseParagraph('**At birth:** in “an ark” ([Exo 2:3](Exodus 2:3)). Then [7:37](Acts 7:37).')).toEqual([
      { kind: 'bold', text: 'At birth:' },
      { kind: 'text', text: ' in “an ark” (' },
      { kind: 'ref', text: 'Exo 2:3', passage: 'Exodus 2:3' },
      { kind: 'text', text: '). Then ' },
      { kind: 'ref', text: '7:37', passage: 'Acts 7:37' },
      { kind: 'text', text: '.' },
    ])
  })

  it('leaves plain text and stray brackets alone', () => {
    expect(parseParagraph('A dam. Say it out loud.')).toEqual([{ kind: 'text', text: 'A dam. Say it out loud.' }])
    expect(parseParagraph('(Heb 7) [sic]')).toEqual([{ kind: 'text', text: '(Heb 7) [sic]' }])
  })

  it('lists the passages a paragraph refers to', () => {
    expect(passagesIn('NT: [Rom 5:12–19](Romans 5:12-19); [1 Cor 15:21–22, 45–49](1 Corinthians 15:21-22,45-49)'))
      .toEqual(['Romans 5:12-19', '1 Corinthians 15:21-22,45-49'])
  })
})

describe('passages', () => {
  it('link to the KJV on BibleGateway, as the guide did', () => {
    expect(passageUrl('1 Corinthians 15:45,47')).toBe('https://www.biblegateway.com/passage/?search=1%20Corinthians%2015%3A45%2C47&version=KJV')
  })

  it('read with en dashes and spaced commas', () => {
    expect(passageTitle('1 Corinthians 15:21-22,45-49')).toBe('1 Corinthians 15:21–22, 45–49')
  })
})
