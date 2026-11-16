<script setup lang="ts">
import type { SpotAnimal } from '~/utils/animalNames'
import { computed, ref, watch } from 'vue'
import { ANIMAL_IDEAS } from '~~/data/challenges'
import { normaliseLabel } from '#shared/utils/scoring'
import { capitalise } from '~/utils/photoName'

// What an award-race photo shows: the animal's name, typed or from suggestion chips, or the
// flower's colour from swatches. One treatment wherever a race photo is named. Under the choice,
// a line when it's worth more elsewhere (an animal that's a Spot it challenge the group hasn't
// earned, `spots`; the sheet then sends it there) or when the group already has it (it still
// sends, it just won't add to the count).
const props = withDefaults(defineProps<{ kind: 'animal' | 'colour', found?: string[], spots?: SpotAnimal[] }>(), { found: () => [], spots: () => [] })
const label = defineModel<string>({ required: true })

const spot = computed(() => props.kind === 'animal' ? spotItFor(label.value, props.spots) : null)
const already = computed(() => !spot.value && !!label.value.trim() && props.found.includes(normaliseLabel(label.value)))

// The chips follow what's typed: nearest first, the rest left out. A chip tapped fills the field
// but doesn't narrow the chips, so another can still be tapped instead.
const typed = ref(label.value)
let chosen = ''
watch(label, (v) => {
  if (v !== chosen) typed.value = v
})
// Spot it animals first, most points first, then animals the group hasn't got yet. Six before
// anything's typed, so the chips stay a few short rows.
const chips = computed(() => {
  if (props.kind !== 'animal') return []
  const spotNames = new Set(props.spots.flatMap(s => s.names))
  const have = new Set(props.found.map(nameKey))
  const all = [
    ...[...props.spots].sort((a, b) => b.points - a.points).map(s => ({ key: s.id, text: s.title, names: [s.title, ...s.names], points: s.points })),
    ...ANIMAL_IDEAS.filter(a => !have.has(nameKey(a)) && !spotNames.has(nameKey(a))).map(a => ({ key: a, text: capitalise(a), names: [a], points: 0 })),
  ]
  return rankNames(typed.value, all, c => c.names).slice(0, nameKey(typed.value) ? 8 : 6)
})
// The chip for what's in the field, or else the nearest to what's typed, is the green one.
const exact = (c: { names: string[] }) => !!nameKey(label.value) && c.names.some(n => nameKey(n) === nameKey(label.value))
const lit = computed(() => chips.value.find(exact) ?? (nameKey(typed.value) ? chips.value[0] : undefined))
function choose(text: string) {
  chosen = text
  label.value = text
}
// "Ants are worth", "Hornbill is worth".
const isAre = (title: string) => /[^s]s$/i.test(title) ? 'are' : 'is'
</script>

<template>
  <div class="space-y-3">
    <template v-if="kind === 'animal'">
      <div class="space-y-2">
        <!-- The sheet's title already says it's an animal; the label is for screen readers. -->
        <Label for="race-animal" class="sr-only">Animal</Label>
        <Input id="race-animal" v-model="label" placeholder="Which animal?" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="40" class="h-12 text-lg" />
        <p v-if="spot" class="text-base font-medium leading-7" role="status">
          {{ spot.title }} {{ isAre(spot.title) }} worth <QuestPointsPill :points="spot.points" class="mx-0.5 align-top" /> in Spot it
        </p>
        <p v-else-if="already" class="text-base font-medium text-warning" role="status">
          Already counted
        </p>
      </div>
      <div v-if="chips.length" class="flex flex-wrap gap-2">
        <Button
          v-for="c in chips" :key="c.key" type="button" size="sm" variant="outline" class="rounded-full"
          :class="[c.points ? 'pr-2' : '', lit === c ? 'border-primary bg-primary/10 text-primary' : '']"
          :aria-pressed="exact(c)"
          @click="choose(c.text)"
        >
          {{ c.text }}<QuestPointsPill v-if="c.points" :points="c.points" />
        </Button>
      </div>
    </template>
    <template v-else>
      <QuestColourChoice v-model="label" :found="found" />
      <p v-if="already" class="text-base font-medium text-warning" role="status">
        Already counted
      </p>
    </template>
  </div>
</template>
