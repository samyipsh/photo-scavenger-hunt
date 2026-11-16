<script setup lang="ts">
import type { Checklist } from '~/types/api'
import { EVENT } from '~~/data/event'
import { computed, ref } from 'vue'
import { CheckIcon, Loader2Icon, WifiOffIcon } from '@lucide/vue'
import { formatClock } from '#shared/utils/rotation'

await useCommitteeGuard()
useHead({ title: `Briefing · ${EVENT.appName}` })

// A refresh that fails keeps the checklist showing (useLastGood), with a line saying so.
const { data: fresh, refresh, error, status } = await useFetch<Checklist>('/api/committee/checklist', { deep: true, lazy: true, timeout: 10_000, headers: { 'x-device-id': deviceId() } })
const data = useLastGood(fresh, error)
useSignInAgain(error)
useVisibleInterval(() => refresh(), 15_000)

const allFirstPhotos = computed(() => !!data.value?.firstPhotos.length && data.value.firstPhotos.every(g => g.sent))
const isDone = (id: string, auto?: string) => auto === 'first-photos' ? allFirstPhotos.value : !!data.value?.ticks[id]
const doneCount = computed(() => data.value?.items.filter(i => isDone(i.id, i.auto)).length ?? 0)

// The tick being saved, shown as a spinner in its box until the app has it. One that didn't
// save says so under its own row.
const saving = ref<string | null>(null)
const failedTick = ref<{ id: string, text: string } | null>(null)
async function toggle(id: string) {
  if (!data.value || saving.value) return
  saving.value = id
  failedTick.value = null
  try {
    const res = await $fetch('/api/committee/checklist', { method: 'POST', body: { id, done: !data.value.ticks[id] } })
    data.value.ticks = res.ticks
  }
  catch (err) {
    failedTick.value = { id, text: errorText(err) }
  }
  finally {
    saving.value = null
  }
}
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <CommitteeHeader title="Briefing" back="/c" />

    <div v-if="error && !data" class="mt-10 flex flex-col items-center gap-3 text-center">
      <p class="text-base">
        The checklist couldn't load.
      </p>
      <Button variant="outline" @click="refresh()">
        Try again
      </Button>
    </div>
    <div v-else-if="!data" class="mt-3 space-y-2" aria-busy="true">
      <Skeleton class="h-6 w-28" />
      <Skeleton class="h-96 w-full rounded-2xl" />
    </div>

    <template v-else>
      <!-- A refresh that failed after a good load: the checklist stays as it was, and says so, as
           on the committee's home. -->
      <div v-if="error" class="mt-3 flex min-h-12 items-center gap-3 rounded-2xl bg-warning-soft py-1 pl-4 pr-1 text-base" role="status">
        <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
        <p class="min-w-0 flex-1">
          <span class="whitespace-nowrap font-semibold">No signal ·</span>
          {{ ' ' }}<span class="whitespace-nowrap">may be out of date</span>
        </p>
        <Button variant="ghost" class="shrink-0 text-primary hover:text-primary" :disabled="status === 'pending'" @click="refresh()">
          Retry
        </Button>
      </div>
      <p class="mt-2 text-base text-muted-foreground">
        {{ doneCount }} of {{ data.items.length }} done
      </p>
      <!-- The tickbox sits in the 24 px icon column of every committee list, so the labels line
           up with committee home's titles. Labels are sentences, so regular weight. -->
      <ul class="mt-3 divide-y overflow-hidden rounded-2xl border">
        <li v-for="item in data.items" :key="item.id">
          <!-- Worked out by the app, not tapped: ticked once every group has sent a photo, with
               the count where a ticked item shows its time. -->
          <div v-if="item.auto === 'first-photos'" class="flex items-start gap-3 px-4 py-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-md border-2" :class="allFirstPhotos ? 'border-primary bg-primary text-primary-foreground' : 'border-input'" aria-hidden="true">
              <CheckIcon v-if="allFirstPhotos" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-base">{{ item.label }}</span>
              <span class="mt-1 flex flex-wrap gap-1.5">
                <span v-for="g in data.firstPhotos" :key="g.id" class="rounded-full px-2 py-0.5 text-base font-medium" :class="g.sent ? 'bg-success-soft text-success' : 'bg-warning-soft'">
                  G{{ g.number }}{{ g.sent ? ' ✓' : '' }}<span v-if="!g.sent" class="sr-only"> not yet</span>
                </span>
              </span>
            </span>
            <span class="shrink-0 whitespace-nowrap text-base tabular-nums text-muted-foreground">
              {{ data.firstPhotos.filter(g => g.sent).length }}/{{ data.firstPhotos.length }}
            </span>
          </div>
          <template v-else>
            <button
              type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-muted"
              :aria-pressed="!!data.ticks[item.id]" :aria-busy="saving === item.id" :disabled="!!saving" @click="toggle(item.id)"
            >
              <span v-if="saving === item.id" class="flex size-6 shrink-0 items-center justify-center">
                <Loader2Icon class="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
              </span>
              <span v-else class="flex size-6 shrink-0 items-center justify-center rounded-md border-2" :class="data.ticks[item.id] ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                <CheckIcon v-if="data.ticks[item.id]" class="size-4" />
              </span>
              <span class="min-w-0 flex-1 text-base">{{ item.label }}</span>
              <!-- When it was ticked, quietly, since ticks are shared across committee phones. -->
              <span v-if="data.ticks[item.id] && saving !== item.id" class="shrink-0 whitespace-nowrap text-base text-muted-foreground">{{ formatClock(data.ticks[item.id]!) }}</span>
            </button>
            <p v-if="failedTick?.id === item.id" class="-mt-1 pb-3 pl-13 pr-4 text-base font-semibold text-red-800" role="alert">
              {{ failedTick.text }}
            </p>
          </template>
        </li>
      </ul>
    </template>
  </main>
</template>
