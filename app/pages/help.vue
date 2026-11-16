<script setup lang="ts">
import { ArrowLeftRightIcon, ChevronRightIcon, ExternalLinkIcon, MapPinIcon, PhoneIcon } from '@lucide/vue'
import { DOCUMENTS, EMERGENCY_NUMBER, END_POINT, EVENT, HELP_CONTACTS, MEETING_POINT, stations } from '~~/data/event'
import { GUIDE, TYPES } from '~~/data/guide'
import { mapsUrl } from '~/utils/maps'

// Who to ask: this phone's group IC, then where to go, then the committee and where each of
// them is, then anything else people may want to read (Misc). The committee, their stations and
// the documents come from data/event.ts; the ICs from the app.
useHead({ title: `Help · ${EVENT.appName}` })

const mine = ref<MyGroup | null>(null)
onMounted(() => {
  mine.value = readMyGroup()
})
const { data: groups } = useFetch<{ id: string, number: number, name: string, leader: string | null, token: string }[]>('/api/groups', { lazy: true })
const myGroup = computed(() => mine.value ? groups.value?.find(g => g.token === mine.value!.token) ?? null : null)
// Types of Christ joins Misc once the committee shows the answers; until then it isn't listed.
// A check that can't get through keeps what the last one said.
const { data: typesFresh, error: typesError } = useFetch<{ shown: boolean }>('/api/types/shown', { lazy: true, timeout: 10_000 })
const types = useLastGood(typesFresh, typesError)

const meetingMap = mapsUrl(END_POINT.lat, END_POINT.lng)
const committee = HELP_CONTACTS.map((c) => {
  const station = stations.find(s => s.id === c.station)
  return {
    ...c,
    // The station's full name, as on the rotation card, so nobody has to match a short one.
    where: station ? `${station.name} · ${station.place}` : (c.role ?? ''),
    // "9123 4567", as plain text to select and copy (the owner's choice).
    shown: c.phone ? `${c.phone.slice(0, 4)} ${c.phone.slice(4)}` : null,
  }
})
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <h1 class="text-2xl font-bold leading-tight">
      Help
    </h1>

    <!-- Who to ask first, where to go, and the emergency number, before the committee. Both lists
         are the same grouped list, with any icon in one column on the right. -->
    <ul class="mt-4 divide-y overflow-hidden rounded-2xl border">
      <!-- Change group lives here, not in the menu: it's a one-off fix for whoever opened the wrong
           group's link. -->
      <li v-if="mine">
        <NuxtLink to="/" class="flex min-h-14 items-center gap-3 px-4 py-3 text-base active:bg-muted">
          <span class="min-w-0 flex-1"><span class="font-semibold">Wrong group?</span> Change group</span>
          <ArrowLeftRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </NuxtLink>
      </li>
      <li v-if="myGroup?.leader" class="flex min-h-14 items-center px-4 py-3 text-base">
        <span><span class="font-semibold">Questions?</span> Ask {{ myGroup.leader }}, your group's IC</span>
      </li>
      <li>
        <a :href="meetingMap" target="_blank" rel="noopener" class="flex min-h-14 items-center gap-3 px-4 py-3 text-base active:bg-muted">
          <span class="min-w-0 flex-1"><span class="font-semibold">Lost?</span> Go to <span class="inline-block">{{ MEETING_POINT.replace(/^the /, '') }}</span></span>
          <MapPinIcon class="size-5 shrink-0 text-muted-foreground" aria-label="map" />
        </a>
      </li>
      <li>
        <a :href="`tel:${EMERGENCY_NUMBER}`" class="flex min-h-14 items-center gap-3 px-4 py-3 text-base active:bg-muted">
          <span class="min-w-0 flex-1"><span class="font-semibold">Emergency?</span> Call {{ EMERGENCY_NUMBER }}</span>
          <PhoneIcon class="size-5 shrink-0 text-destructive" aria-hidden="true" />
        </a>
      </li>
    </ul>

    <section class="mt-6">
      <h2 class="text-xl font-bold">
        Committee
      </h2>
      <ul class="mt-2 divide-y overflow-hidden rounded-2xl border">
        <!-- The name and any number on one line, so the number lines up with the name it
             belongs to; the station (or role) below, across the full width. -->
        <li v-for="person in committee" :key="person.name" class="px-4 py-3 text-base">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-semibold">{{ person.name }}</span>
            <span v-if="person.shown" class="shrink-0 select-all font-semibold tabular-nums">{{ person.shown }}</span>
          </span>
          <span v-if="person.where" class="block text-muted-foreground">{{ person.where }}</span>
        </li>
      </ul>
    </section>

    <!-- The guide, Types of Christ once shown, then any pages and PDFs outside the app, each of
         those opening in a new tab. -->
    <section class="mt-6">
      <h2 class="text-xl font-bold">
        Misc
      </h2>
      <ul class="mt-2 divide-y overflow-hidden rounded-2xl border">
        <li>
          <NuxtLink to="/guide" class="flex min-h-14 items-center gap-3 px-4 py-3 text-base active:bg-muted">
            <span class="min-w-0 flex-1 font-semibold">{{ GUIDE.title }}</span>
            <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li v-if="types?.shown">
          <NuxtLink to="/types" class="flex min-h-14 items-center gap-3 px-4 py-3 text-base active:bg-muted">
            <span class="min-w-0 flex-1 font-semibold">{{ TYPES.title }}</span>
            <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li v-for="d in DOCUMENTS" :key="d.url">
          <a :href="d.url" target="_blank" rel="noopener" class="flex min-h-14 items-center gap-3 px-4 py-3 text-base active:bg-muted">
            <span class="min-w-0 flex-1 font-semibold">{{ d.label }}</span>
            <ExternalLinkIcon class="size-5 shrink-0 text-muted-foreground" aria-label="opens in a new tab" />
          </a>
        </li>
      </ul>
    </section>
  </main>
</template>
