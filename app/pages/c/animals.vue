<script setup lang="ts">
import type { LabelRow } from '~/types/api'
import { EVENT } from '~~/data/event'
import { ANIMAL_IDEAS, challenges as challengeSeeds } from '~~/data/challenges'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, MergeIcon } from '@lucide/vue'
import { capitalise } from '~/utils/photoName'

// Animal names as groups typed them, for merging spellings: renaming "hornbil" to "hornbill"
// moves every photo with it, so the animal race counts it once.
await useCommitteeGuard()
useHead({ title: `Animal names · ${EVENT.appName}` })

const router = useRouter()
const { data: labels, refresh, error } = await useFetch<LabelRow[]>('/api/committee/labels', { headers: { 'x-device-id': deviceId() } })
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

// Back to the judge view this page was opened from, filter and all; straight to the queue when
// the page was opened on its own.
function back() {
  if (window.history.state?.back) router.back()
  else router.push('/c/judge')
}

// Letter edits between two names.
function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]!
}

// A likely misspelling: one letter away from another name ("hornbil", "hornbill"). The right
// spelling is the one the event already knows (a Spot it animal or an idea from the list), else
// the one more groups used; when nothing says which, there's no suggestion.
const known = new Set([...ANIMAL_IDEAS, ...challengeSeeds.flatMap(c => c.animal ? [c.animal] : [])].map(normaliseLabel))
const mergeHints = computed(() => {
  const rows = labels.value ?? []
  const hints = new Map<string, string>()
  for (const a of rows) {
    if (known.has(a.label) || a.label.length < 4) continue
    const into = rows.find(b => b !== a && editDistance(a.label, b.label) === 1
      && (known.has(b.label) || b.groups.length > a.groups.length || (b.groups.length === a.groups.length && b.count > a.count)))
    if (into) hints.set(a.label, into.label)
  }
  return hints
})

// What just happened, in a line at the foot of the screen for a few seconds, with Undo, as on
// the judge's page: "Merged 1 photo into Hornbill".
interface Said { text: string, error?: boolean, undo?: () => Promise<void> }
const said = ref<Said | null>(null)
let saidTimer: ReturnType<typeof setTimeout> | undefined
function say(next: Said | null) {
  said.value = next
  clearTimeout(saidTimer)
  if (next) {
    saidTimer = setTimeout(() => {
      said.value = null
    }, 8000)
  }
}
onBeforeUnmount(() => clearTimeout(saidTimer))

// One tap merges, with Undo.
const merging = ref<string | null>(null)
async function merge(from: LabelRow, into: string) {
  if (merging.value) return
  merging.value = from.label
  try {
    const res = await $fetch('/api/committee/labels', { method: 'POST', headers: { 'x-device-id': deviceId() }, body: { from: from.label, to: into } })
    await refresh()
    say({ text: `Merged ${plural(res.renamed, 'photo')} into ${capitalise(into)}`, undo: () => putBack(into, from.label, res.ids) })
  }
  catch (err) {
    say({ text: errorText(err), error: true })
  }
  finally {
    merging.value = null
  }
}
// Undo a merge or rename: only the photos it changed go back, not those that had the name already.
async function putBack(from: string, to: string, ids: string[]) {
  say(null)
  try {
    await $fetch('/api/committee/labels', { method: 'POST', headers: { 'x-device-id': deviceId() }, body: { from, to, ids } })
    await refresh()
    say({ text: `${capitalise(to)} is back` })
  }
  catch (err) {
    say({ text: errorText(err), error: true })
  }
}

const open = ref(false)
// The name being renamed, kept while the sheet closes so its content doesn't jump.
const renaming = ref<LabelRow | null>(null)
const renameTo = ref('')
const saving = ref(false)
function startRename(l: LabelRow) {
  renaming.value = l
  renameTo.value = capitalise(l.label)
  open.value = true
}

// How alike two names are, so likely misspellings come first: 0 when one holds the other ("swan",
// "black swan"); otherwise the letter edits, with a shared start of three letters counting as close.
function closeness(a: string, b: string) {
  if (a.includes(b) || b.includes(a)) return 0
  let same = 0
  while (same < a.length && a[same] === b[same]) same++
  const d = editDistance(a, b)
  return same >= 3 ? Math.min(d, 1) : d
}
// Every other name, so typing one in full merges into it too.
const others = computed(() => (labels.value ?? []).filter(x => x.label !== renaming.value?.label))
// The names offered as chips, likely misspellings of this one first. A name that is itself a
// likely misspelling ("Hornbil") isn't offered: merging into it would spread the typo.
const chips = computed(() => {
  const from = renaming.value?.label ?? ''
  return others.value
    .filter(x => !mergeHints.value.has(x.label))
    .map(x => ({ label: x.label, close: closeness(from, x.label) }))
    .sort((a, b) => a.close - b.close || a.label.localeCompare(b.label))
})
const target = computed(() => normaliseLabel(renameTo.value))
const unchanged = computed(() => !target.value || target.value === renaming.value?.label)
const mergeInto = computed(() => others.value.find(o => o.label === target.value)?.label ?? null)
// Until the name changes, the button says what to do rather than name a change it won't make.
const action = computed(() => {
  const photos = plural(renaming.value?.count ?? 0, 'photo')
  if (unchanged.value) return 'Pick or type a name'
  return mergeInto.value ? `Merge ${photos} into ${capitalise(mergeInto.value)}` : `Rename ${photos}`
})

// A failed save says so above the button, where the judge is looking.
const renameError = ref('')
watch([open, renameTo], () => {
  renameError.value = ''
})
async function rename() {
  const from = renaming.value
  if (!from || saving.value || unchanged.value) return
  const to = normaliseLabel(renameTo.value)
  const merged = mergeInto.value
  saving.value = true
  try {
    const res = await $fetch('/api/committee/labels', { method: 'POST', headers: { 'x-device-id': deviceId() }, body: { from: from.label, to: renameTo.value.trim() } })
    open.value = false
    await refresh()
    say({
      text: `${merged ? 'Merged' : 'Renamed'} ${plural(res.renamed, 'photo')} ${merged ? 'into' : 'to'} ${capitalise(to)}`,
      undo: () => putBack(to, from.label, res.ids),
    })
  }
  catch (err) {
    renameError.value = errorText(err)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Room at the foot for the line saying what just happened, so it never covers the last name. -->
  <main class="mx-auto min-h-dvh max-w-lg px-4 pt-2" :class="said ? 'pb-24' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'">
    <!-- As CommitteeHeader, but back goes back in history, to the judge view it came from. The
         tap area runs from the screen's edge, all of it on screen; the chevron is nudged inside it
         so its point sits on the content edge. -->
    <header class="flex items-center gap-2">
      <Button variant="ghost" size="icon" class="-ml-4 shrink-0" aria-label="Back" @click="back">
        <ChevronLeftIcon class="size-6 -translate-x-0.5" />
      </Button>
      <h1 class="min-w-0 flex-1 text-2xl font-bold leading-tight">
        Animal names
      </h1>
    </header>

    <div v-if="error" class="mt-10 flex flex-col items-center gap-3 text-center">
      <p class="text-base">
        Names couldn't load.
      </p>
      <Button variant="outline" @click="refresh()">
        Try again
      </Button>
    </div>
    <!-- The committee's inset grouped list. A likely misspelling has its merge right under it. -->
    <ul v-else-if="labels?.length" class="mt-3 divide-y overflow-hidden rounded-2xl border">
      <li v-for="l in labels" :key="l.label">
        <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-muted" @click="startRename(l)">
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">{{ capitalise(l.label) }}</span>
            <!-- One photo is always one group. -->
            <span class="block text-base text-muted-foreground">{{ plural(l.count, 'photo') }}{{ l.count > 1 ? ` · ${plural(l.groups.length, 'group')}` : '' }}</span>
          </span>
          <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <Button
          v-if="mergeHints.get(l.label)" variant="ghost" class="-mt-1 mb-1 ml-1 px-3 text-base text-primary hover:text-primary" :disabled="!!merging"
          @click="merge(l, mergeHints.get(l.label)!)"
        >
          <Loader2Icon v-if="merging === l.label" class="animate-spin" aria-hidden="true" /><MergeIcon v-else aria-hidden="true" />
          Merge into {{ capitalise(mergeHints.get(l.label)!) }}
        </Button>
      </li>
    </ul>
    <p v-else class="mt-10 text-center text-base text-muted-foreground">
      No animals named yet.
    </p>

    <!-- The photos it would change, the new name, and the other names to merge into. The button
         is pinned at the foot, so the keyboard never hides it. -->
    <BottomSheet v-model:open="open" :title="`Rename ${renaming ? capitalise(renaming.label) : ''}`" content-class="max-h-[88dvh]">
      <form v-if="renaming" id="rename-form" class="-mx-4 grid min-h-0 gap-3 overflow-y-auto px-4 pb-1" @submit.prevent="rename">
        <div v-if="renaming.thumbs.length" class="flex gap-2">
          <img v-for="t in renaming.thumbs" :key="t" :src="t" alt="" class="size-14 rounded-lg bg-muted object-cover">
        </div>
        <Input v-model="renameTo" aria-label="New name" maxlength="40" autocomplete="off" class="h-12 text-lg" />
        <!-- The other names, likely misspellings of this one first: tapping one picks it, and the
             button below merges into it. -->
        <div v-if="chips.length" class="flex flex-wrap gap-2">
          <Button
            v-for="o in chips" :key="o.label" type="button" size="sm" :variant="target === o.label ? 'default' : 'outline'" class="rounded-full"
            :aria-pressed="target === o.label" @click="renameTo = capitalise(o.label)"
          >
            {{ capitalise(o.label) }}
          </Button>
        </div>
      </form>
      <template #footer>
        <p v-if="renameError" class="mb-2 text-base font-semibold text-red-800" role="alert">
          {{ renameError }}
        </p>
        <Button type="submit" form="rename-form" size="lg" class="w-full" :disabled="saving || unchanged">
          <Loader2Icon v-if="saving" class="animate-spin" aria-hidden="true" />
          {{ saving ? 'Saving…' : action }}
        </Button>
      </template>
    </BottomSheet>

    <!-- What just happened, fixed at the foot as in the judge's bar. -->
    <div v-if="said" class="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
      <div class="mx-auto flex min-h-11 max-w-lg items-center justify-between gap-3 px-4" :role="said.error ? 'alert' : 'status'">
        <p class="flex min-w-0 items-center gap-2 text-base leading-snug" :class="said.error && 'font-semibold text-red-800'">
          {{ said.text }}
        </p>
        <Button v-if="said.undo" variant="outline" class="shrink-0" @click="said.undo()">
          Undo
        </Button>
      </div>
    </div>
  </main>
</template>
