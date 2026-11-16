import type { SheetOption, SheetSection } from '~/components/OptionList.vue'
import { CHALLENGE_KINDS } from '~~/data/challenges'

// The order challenges are listed in to browse or judge them: the two races (Animals spotted,
// Flower colours) first, since any animal or flower goes there, then the group page's tabs. The
// gallery's challenge filter, one group's photos by challenge and the judge's grid all use it.
// The picker for placing a photo puts Spot it next instead: ['award', 'spot'].
export const LIST_ORDER: string[] = ['award', ...CHALLENGE_KINDS.map(k => k.type).filter(t => t !== 'award')]

// The challenge list as OptionList sections: `lead` rows first ("All challenges", "Just a
// photo"), then a section per kind in the order of the group page's tabs. `order` puts some
// kinds first: the picker uses ['award', 'spot'] (the two races, which take any animal or
// flower, then things spotted on the way), the gallery's filter ['award']. Each row shows its points; one the group already has (`done`) shows them filled,
// as on the group page, and goes to the end of its section, since a second photo won't add.
export function challengeSections<T extends { id: string, title: string, type: string, active?: boolean, points?: number }>(
  list: T[],
  opts: { lead?: SheetOption[], done?: string[], includeRetired?: boolean, points?: boolean, order?: string[] } = {},
): SheetSection[] {
  const live = opts.includeRetired ? list : list.filter(c => c.active !== false)
  const row = (c: T): SheetOption => ({
    value: c.id,
    label: c.title,
    earned: opts.done?.includes(c.id) || undefined,
    points: opts.points !== false && c.points ? c.points : undefined,
  })
  const first = opts.order ?? []
  const rank = (type: string) => first.includes(type) ? first.indexOf(type) : first.length + CHALLENGE_KINDS.findIndex(k => k.type === type)
  const sections = [...CHALLENGE_KINDS]
    .sort((a, b) => rank(a.type) - rank(b.type))
    .map(k => ({
      type: k.type as string,
      title: k.label as string,
      options: live.filter(c => c.type === k.type).map(row).sort((a, b) => Number(!!a.earned) - Number(!!b.earned)),
    }))
    .filter(s => s.options.length)
  return [...(opts.lead?.length ? [{ options: opts.lead }] : []), ...sections]
}
