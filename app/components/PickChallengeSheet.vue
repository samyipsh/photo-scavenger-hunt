<script setup lang="ts">
import type { ChallengeOption } from '~/types/api'
import type { SheetOption, SheetSection } from '~/components/OptionList.vue'
import { computed, ref, watch } from 'vue'
import { ChevronLeftIcon, Loader2Icon, PencilIcon, PlusIcon } from '@lucide/vue'
import { ANIMAL_IDEAS, CHALLENGE_KINDS } from '~~/data/challenges'
import { FLOWER_COLOURS } from '#shared/utils/awards'
import { capitalise } from '~/utils/photoName'

// Where a photo belongs, in one sheet: tap a challenge and that's it. Only the two races need a
// second step, the animal's name or the flower's colour, in the same sheet. The photo being
// placed stays in the header through both steps, so nobody labels the wrong one. Used by the
// sender, the judge and the gallery alike; the caller does the saving. It always opens on the
// list, at the top: an animal or colour already named gets its likely fix and a way to change
// the name above the list.
const props = withDefaults(defineProps<{
  // Hints and Spot it animals, when the listing has them, widen the search.
  challenges: (ChallengeOption & { hint?: string | null, animal?: string | null })[]
  challengeId: string | null
  label: string | null
  thumbUrl?: string
  // Offer "Just a photo" (not for a photo that's already just a photo).
  allowNone?: boolean
  // The group's challenges, animals and colours so far, so the sheet can say what won't add.
  // Given `done`, an animal that's a Spot it challenge the group hasn't earned goes there.
  done?: string[]
  animalsFound?: string[]
  coloursFound?: string[]
  busy?: boolean
  // The committee's sheet: a name is fixed as typed, never steered to Spot it points (whether
  // to move a photo there is the judge's call, with its own button).
  quickNames?: boolean
}>(), { allowNone: true, animalsFound: () => [], coloursFound: () => [] })
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [choice: { challengeId: string | null, label: string | null }] }>()

const race = ref<ChallengeOption | null>(null)
const name = ref('')
const query = ref('')
watch(open, (v) => {
  if (!v) return
  race.value = null
  name.value = ''
  query.value = ''
})
// Back from naming returns to the list, as its arrow does.
useBackClose(() => open.value && !!race.value, () => { race.value = null })

const byId = computed(() => new Map(props.challenges.map(c => [c.id, c])))
const live = computed(() => props.challenges.filter(c => c.active !== false))
const animalsRace = computed(() => live.value.find(c => c.awardKind === 'animal') ?? null)
const current = computed(() => props.challengeId ? byId.value.get(props.challengeId) ?? null : null)
const currentRace = computed(() => current.value?.awardKind ? current.value : null)
// Spot it animals, the ones the group hasn't earned (only when the caller says what it has),
// and every animal name the event knows.
const allSpots = computed(() => spotAnimals(props.challenges))
const spots = computed(() => props.done && !props.quickNames ? allSpots.value.filter(s => !props.done!.includes(s.id)) : [])
const known = computed(() => [...new Set([...ANIMAL_IDEAS.map(nameKey), ...allSpots.value.flatMap(s => s.names)])])

// The photo's own place again closes the sheet: nothing changes, and saving it again would
// clear a rejection.
function choose(choice: { challengeId: string | null, label: string | null }) {
  if (choice.challengeId === props.challengeId && normaliseLabel(choice.label ?? '') === normaliseLabel(props.label ?? '')) {
    open.value = false
    return
  }
  emit('pick', choice)
}

// An animal already named: "Move to Hornbill" when it's a Spot it challenge the group hasn't
// earned, or "Rename to Hornbill" when the name is likely a misspelling.
const fix = computed(() => {
  const c = currentRace.value
  if (c?.awardKind !== 'animal' || !props.label) return null
  const spot = spotItFor(props.label, spots.value)
  if (spot) return { text: `Move to ${spot.title}`, points: spot.points, choice: { challengeId: spot.id, label: null } }
  const to = likelyFix(props.label, known.value)
  return to ? { text: `Rename to ${capitalise(to)}`, points: 0, choice: { challengeId: c.id, label: capitalise(to) } } : null
})

// Under Just a photo, the two races (Animals spotted, Flower colours): any animal or flower goes
// there, so they're the likeliest picks. Then Spot it: most photos taken before picking a
// challenge are things spotted on the way.
// Typing filters by title and hint ("black swan" finds Swan), forgives a letter off, and offers
// the races too: "kingfisher" is an animal for Animals spotted, "orange" a colour for Flower
// colours. Typing that finds nothing says so, with an explicit way to add it as an animal.
// Every word typed starts a word of the text, in any order.
const fits = (text: string, typed: string[]) => {
  const have = nameWords(text)
  return typed.every(t => have.some(w => w.startsWith(t)))
}
const near = (typed: string, text?: string | null) => !!text && (nameCloseness(typed, text) ?? 9) <= 2
// Race rows offered while searching, by their row value.
const raceTargets = computed(() => {
  const out = new Map<string, { challengeId: string, label: string, option: SheetOption }>()
  const q = query.value.trim()
  const typed = nameWords(q).filter(w => !['flower', 'colour', 'color'].includes(w))
  if (!typed.length || q.length < 2) return out
  const add = (c: ChallengeOption, label: string, found: string[]) => out.set(`race:${c.id}:${label}`, {
    challengeId: c.id,
    label,
    option: { value: `race:${c.id}:${label}`, label: `${c.title}: ${capitalise(label)}`, note: found.includes(label) ? 'Already counted' : undefined },
  })
  const colours = live.value.find(c => c.awardKind === 'colour')
  if (colours) FLOWER_COLOURS.filter(c => fits(c, typed)).forEach(c => add(colours, c, props.coloursFound))
  if (animalsRace.value) {
    // An animal with its own Spot it challenge is found there (it adds to the race as well), and
    // a name one letter off a known one is somebody's misspelling, not a name to offer.
    const own = new Set(allSpots.value.flatMap(s => s.names))
    const names = [...new Set([...ANIMAL_IDEAS, ...props.animalsFound])]
      .filter(a => !own.has(nameKey(a)) && !likelyMisspelling(a, known.value) && near(q, a))
    rankNames(q, names, a => [a]).forEach(a => add(animalsRace.value!, a, props.animalsFound))
  }
  return out
})
const sections = computed<SheetSection[]>(() => {
  // The races end in a chevron: picking one goes on to naming the animal or colour.
  const all = challengeSections(props.challenges, {
    lead: props.allowNone ? [{ value: 'none', label: 'Just a photo' }] : [],
    done: props.done,
    order: ['award', 'spot'],
  }).map(s => s.type === 'award' ? { ...s, options: s.options.map(o => ({ ...o, next: true })) } : s)
  const q = query.value.trim().toLowerCase()
  if (!q) return all
  const typed = nameWords(q)
  const matches = (o: SheetOption) => {
    const c = byId.value.get(o.value)
    // One letter makes no words: then it's the title that has to contain it.
    if (!typed.length) return o.label.toLowerCase().includes(q)
    return fits(c ? `${c.title} ${c.hint ?? ''}` : o.label, typed) || near(q, c?.title ?? o.label) || near(q, c?.animal)
  }
  const found = all.map(s => ({ ...s, options: s.options.filter(matches) }))
  const races = [...raceTargets.value.values()].map(r => r.option)
  if (races.length) {
    const awards = found.find(s => s.type === 'award')
    if (awards) awards.options.push(...races)
    else found.push({ type: 'award', title: CHALLENGE_KINDS.find(k => k.type === 'award')!.label, options: races })
  }
  return found.filter(s => s.options.length)
})
// Nothing found: what was typed can still be an animal nobody listed, if someone says so.
const newAnimal = computed(() => {
  const q = query.value.trim().replace(/\s+/g, ' ')
  return animalsRace.value && !sections.value.length && nameKey(q) && q.length <= 40 ? capitalise(q) : null
})
const title = computed(() => race.value ? race.value.title : props.challengeId ? 'Change challenge' : 'Pick a challenge')

// A race's own step, with the name or colour it has if the photo is already there.
function nameIt(c: ChallengeOption) {
  race.value = c
  name.value = c.id === props.challengeId ? (props.label ?? '') : ''
}
function pick(o: SheetOption) {
  if (o.value.startsWith('race:')) {
    const hit = raceTargets.value.get(o.value)
    if (hit) choose({ challengeId: hit.challengeId, label: hit.label })
    return
  }
  const c = byId.value.get(o.value)
  if (c?.awardKind) return nameIt(c)
  choose({ challengeId: o.value === 'none' ? null : o.value, label: null })
}

// Naming: an animal that's a Spot it challenge the group hasn't earned goes there instead. What
// the group has leaves out this photo's own name, so renaming it doesn't warn about itself.
const spot = computed(() => race.value?.awardKind === 'animal' ? spotItFor(name.value, spots.value) : null)
const found = computed(() => {
  const list = race.value?.awardKind === 'animal' ? props.animalsFound : props.coloursFound
  const own = race.value?.id === props.challengeId && props.label ? normaliseLabel(props.label) : null
  return own ? list.filter(x => x !== own) : list
})
const already = computed(() => !spot.value && !!name.value.trim() && found.value.includes(normaliseLabel(name.value)))
const unchanged = computed(() => race.value?.id === props.challengeId && normaliseLabel(name.value) === normaliseLabel(props.label ?? ''))
function save() {
  if (!race.value || !name.value.trim() || unchanged.value || props.busy) return
  choose(spot.value ? { challengeId: spot.value.id, label: null } : { challengeId: race.value.id, label: name.value.trim() })
}
const buttonText = computed(() => {
  const n = name.value.trim()
  const colour = race.value?.awardKind === 'colour'
  if (!n || unchanged.value) return colour ? `Choose ${n ? 'another' : 'a'} colour` : 'Pick or type a name'
  if (spot.value) return `Use for ${spot.value.title}`
  if (already.value) return 'Use anyway'
  if (race.value?.id === props.challengeId) return colour ? `Change to ${capitalise(n)}` : `Rename to ${capitalise(n)}`
  return `Use for ${capitalise(n)}${colour ? ' flower' : ''}`
})
</script>

<template>
  <BottomSheet v-model:open="open" :title="title" content-class="max-h-[88dvh]">
    <template #title>
      <!-- One row: the back arrow when naming (its 44 px button flush with the sheet's edge, its
           point on the content edge), the photo, then the title. -->
      <div class="flex items-center gap-2">
        <button v-if="race" type="button" class="-ml-4 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full active:bg-muted" aria-label="Back to the list" @click="race = null">
          <ChevronLeftIcon class="size-6 -translate-x-0.5" />
        </button>
        <img v-if="thumbUrl" :src="thumbUrl" alt="" class="mr-1 size-11 shrink-0 rounded-lg object-cover">
        <DrawerTitle class="min-w-0 text-left text-xl font-bold leading-tight">
          {{ title }}
        </DrawerTitle>
      </div>
    </template>

    <template v-if="!race">
      <!-- An animal or colour entry: its likely fix, then a change of name or colour. -->
      <div v-if="currentRace" class="mb-2 flex shrink-0 flex-wrap gap-2">
        <Button v-if="fix" variant="outline" :class="fix.points ? 'pr-2' : ''" :disabled="busy" @click="choose(fix.choice)">
          {{ fix.text }}<QuestPointsPill v-if="fix.points" :points="fix.points" />
        </Button>
        <Button variant="outline" :disabled="busy" @click="nameIt(currentRace)">
          <PencilIcon /> {{ currentRace.awardKind === 'colour' ? 'Change colour' : 'Edit name' }}
        </Button>
      </div>
      <Input v-model="query" type="search" placeholder="Search" aria-label="Search challenges" autocomplete="off" class="mb-1 shrink-0" />
      <OptionList :sections="sections" label="Challenge" :current="challengeId ?? 'none'" :scroll-to-current="false" :disabled="busy" @pick="pick" />
      <div v-if="!sections.length" class="flex flex-col items-center gap-3 py-6 text-center">
        <p class="text-base text-muted-foreground">
          No challenge called that.
        </p>
        <Button v-if="newAnimal" variant="outline" class="h-auto min-h-11 max-w-full whitespace-normal py-2" :disabled="busy" @click="choose({ challengeId: animalsRace!.id, label: newAnimal })">
          <PlusIcon /> Add animal “{{ newAnimal }}”
        </Button>
      </div>
    </template>

    <form v-else id="pick-name" class="-mx-4 min-h-0 overflow-y-auto px-4 pb-1 pt-1" @submit.prevent="save">
      <!-- The same naming step as sending a race photo from its sheet. -->
      <QuestRaceLabel
        v-model="name" :kind="race.awardKind === 'animal' ? 'animal' : 'colour'" :found="found" :spots="race.awardKind === 'animal' ? spots : []"
      />
    </form>

    <!-- Pinned, so it stays in reach with the keyboard up. A name the group already has still
         goes, as a choice rather than the main action. -->
    <template v-if="race" #footer>
      <Button type="submit" form="pick-name" size="lg" class="w-full" :variant="already ? 'outline' : 'default'" :disabled="busy || !name.trim() || unchanged">
        <Loader2Icon v-if="busy" class="animate-spin" aria-hidden="true" />
        {{ buttonText }}
        <span v-if="spot" class="inline-flex items-center rounded-full bg-primary-foreground px-2.5 text-base font-bold leading-7 tabular-nums text-primary">+{{ spot.points }}</span>
      </Button>
    </template>
  </BottomSheet>
</template>
