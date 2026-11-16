// Writes the seed SQL for groups, stations and challenges.
//   node scripts/seed.ts [--base-url https://...]
// Group tokens are created once and kept in data/tokens.local.json (not in git), because
// they're in the links we send out. Re-running updates names and challenge text without
// touching tokens or photos.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { challenges } from '../data/challenges.ts'
import { GROUP_COUNT, GROUP_LEADERS, stations } from '../data/event.ts'
import { groupName } from '../shared/utils/groups.ts'

const tokensPath = new URL('../data/tokens.local.json', import.meta.url)
const outDir = new URL('../.wrangler/', import.meta.url)
const baseUrlArg = process.argv.indexOf('--base-url')
const baseUrl = baseUrlArg > -1 ? process.argv[baseUrlArg + 1] : 'http://localhost:3000'

const tokens: Record<string, string> = existsSync(tokensPath) ? JSON.parse(readFileSync(tokensPath, 'utf8')) : {}
for (let n = 1; n <= GROUP_COUNT; n++) {
  tokens[`g${n}`] ??= randomBytes(18).toString('base64url')
}
tokens.recce ??= randomBytes(18).toString('base64url')
writeFileSync(tokensPath, `${JSON.stringify(tokens, null, 2)}\n`)

const q = (v: unknown) => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : `'${String(v).replaceAll('\'', '\'\'')}'`

const sql: string[] = []
// Group IDs are g1, g2… and recce. The gallery's Group filter keeps `mine` for My photos, so no
// group may be called that.
for (let n = 1; n <= GROUP_COUNT; n++) {
  const id = `g${n}`
  const leader = GROUP_LEADERS[n] ?? null
  // The ICs in data/event.ts are only a starting point: once the committee changes one in the
  // app, a later seed keeps it.
  sql.push(`INSERT INTO groups (id, number, name, leader, token, start_slot) VALUES (${q(id)}, ${n}, ${q(groupName(n, leader))}, ${q(leader)}, ${q(tokens[id])}, ${n})
  ON CONFLICT(id) DO UPDATE SET number = excluded.number, start_slot = excluded.start_slot;`)
}
// Groups past GROUP_COUNT, once it's lowered: removed when nothing refers to them, otherwise
// hidden, which keeps their photos and scores but takes them off the group list, the timetable
// and the scoreboard.
const extra = `hidden = 0 AND number > ${GROUP_COUNT}`
sql.push(`DELETE FROM groups WHERE ${extra} AND id NOT IN (SELECT group_id FROM photos) AND id NOT IN (SELECT group_id FROM station_scores) AND id NOT IN (SELECT group_id FROM blocked_devices);`)
sql.push(`UPDATE groups SET hidden = 1 WHERE ${extra};`)
// The recce team's photos, kept as examples. Hidden from scoring and the rotation.
sql.push(`INSERT INTO groups (id, number, name, token, start_slot, hidden) VALUES ('recce', 0, 'Group Recce Team', ${q(tokens.recce)}, 1, 1)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, hidden = 1;`)
// The gallery's Everyone filter already shows every group, so there's no separate album.
for (const s of stations) {
  sql.push(`INSERT INTO stations (id, name, slot, scored, lower_wins, place, lat, lng) VALUES (${[s.id, s.name, s.slot, s.scored, s.lowerWins ?? false, s.place, s.lat, s.lng].map(q).join(', ')})
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, slot = excluded.slot, scored = excluded.scored, lower_wins = excluded.lower_wins, place = excluded.place, lat = excluded.lat, lng = excluded.lng;`)
}
challenges.forEach((c, i) => {
  sql.push(`INSERT INTO challenges (id, type, title, flavour, hint, points, who_in_shot, award_kind, animal, sort, active) VALUES (${[c.id, c.type, c.title, c.flavour, c.hint, c.points, c.whoInShot, c.awardKind, c.animal, i, c.active ?? true].map(q).join(', ')})
  ON CONFLICT(id) DO UPDATE SET type = excluded.type, title = excluded.title, flavour = excluded.flavour, hint = excluded.hint, points = excluded.points, who_in_shot = excluded.who_in_shot, award_kind = excluded.award_kind, animal = excluded.animal, sort = excluded.sort, active = excluded.active;`)
})
// Challenges no longer in the file are hidden, never deleted, so their photos keep a title.
sql.push(`UPDATE challenges SET active = 0 WHERE id NOT IN (${challenges.map(c => q(c.id)).join(', ')});`)
sql.push(`INSERT INTO settings (key, value, updated_at) VALUES ('uploads_open', 'true', ${Date.now()}) ON CONFLICT(key) DO NOTHING;`)

mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('seed.sql', outDir), `${sql.join('\n')}\n`)

console.log('Wrote .wrangler/seed.sql')
for (let n = 1; n <= GROUP_COUNT; n++) console.log(`Group ${n}: ${baseUrl}/g/${tokens[`g${n}`]}`)
console.log(`Group Recce Team: ${baseUrl}/g/${tokens.recce}`)
