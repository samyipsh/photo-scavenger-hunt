// The Types of Christ page: its shape, and how its paragraphs are written. The words are in
// data/types-of-christ.ts, which only the server reads; /api/types sends them once the committee
// shows them (Manage › Controls).
//
// A paragraph is plain text with two marks:
//   [Rom 5:14](Romans 5:14)   a Bible reference: the words shown, then the passage as BibleGateway
//                             names it (and as `verses` is keyed)
//   **At birth:**             bold

export interface TypeOfChrist {
  name: string
  // The hint as on the puzzle card, one entry a line.
  hint: string[]
  // How the hint matches, then how the type points to Christ: a paragraph each.
  match: string[]
  type: string[]
  // The passages to read, on one line ("OT: … · NT: …").
  refs: string
}

export interface TypesOfChristPage {
  intro: string
  types: TypeOfChrist[]
  // The KJV text of each referenced passage, verse by verse, so a tapped reference can show it.
  verses: Record<string, [verse: number, text: string][]>
}

export type Segment =
  | { kind: 'text', text: string }
  | { kind: 'bold', text: string }
  | { kind: 'ref', text: string, passage: string }

const MARK = /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*/g

export function parseParagraph(paragraph: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of paragraph.matchAll(MARK)) {
    if (m.index > last) out.push({ kind: 'text', text: paragraph.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'ref', text: m[1], passage: m[2]! })
    else out.push({ kind: 'bold', text: m[3]! })
    last = m.index + m[0].length
  }
  if (last < paragraph.length) out.push({ kind: 'text', text: paragraph.slice(last) })
  return out
}

// Every passage a paragraph refers to.
export function passagesIn(paragraph: string): string[] {
  return parseParagraph(paragraph).flatMap(s => s.kind === 'ref' ? [s.passage] : [])
}

// The passage in the KJV on BibleGateway.
export function passageUrl(passage: string): string {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(passage)}&version=KJV`
}

// "Hebrews 7:14-17" reads "Hebrews 7:14–17"; "1 Corinthians 15:45,47" reads "1 Corinthians 15:45, 47".
export function passageTitle(passage: string): string {
  return passage.replace(/-/g, '–').replace(/,/g, ', ')
}
