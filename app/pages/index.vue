<script setup lang="ts">
import type { GroupLink } from '~/types/api'
import { EVENT, GROUP_COUNT } from '~~/data/event'
import { ChevronRightIcon } from '@lucide/vue'

useHead({ title: EVENT.appName })
const { data: groups, error, refresh, status } = await useFetch<GroupLink[]>('/api/groups', { lazy: true })

// Read before the first paint (the app runs only in the browser), so the page doesn't change
// shape once it's up.
const mine = ref<MyGroup | null>(readMyGroup())
// Once the list is in, it wins: a group whose IC changed shows its new name, and a group that's
// gone loses its Continue button.
watch(groups, (list) => {
  const saved = mine.value
  if (!list || !saved) return
  const g = list.find(x => x.token === saved.token)
  if (!g) {
    forgetMyGroup(saved.token)
    mine.value = null
  }
  else if (g.name !== saved.name) {
    mine.value = { ...saved, name: g.name }
    rememberMyGroup(mine.value)
  }
}, { immediate: true })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
    <!-- The day and place, for a first visit; a phone that knows its group goes straight on. -->
    <p v-if="!mine" class="text-base font-medium text-muted-foreground">
      {{ EVENT.dateLabel }} · {{ EVENT.venue }}
    </p>
    <!-- The app's ordinary main button, so it reads as the way on, not as a painted list row. -->
    <Button v-if="mine" as="a" :href="`/g/${mine.token}`" size="lg" class="w-full">
      <span class="min-w-0 truncate">Continue as {{ mine.name }}</span>
    </Button>

    <section :class="mine ? 'mt-8' : 'mt-2'">
      <!-- Quieter than the Continue button when this phone already has a group. -->
      <h1 :class="mine ? 'text-lg font-semibold text-muted-foreground' : 'text-2xl font-bold'">
        {{ mine ? 'Other groups' : 'Choose your group' }}
      </h1>
      <!-- One list, a row per group. The name already says its number, so there's no badge. -->
      <ul v-if="groups" class="mt-3 divide-y overflow-hidden rounded-2xl border">
        <li v-for="g in groups.filter(x => x.token !== mine?.token)" :key="g.id">
          <a :href="`/g/${g.token}`" class="flex min-h-14 items-center gap-3 px-4 text-lg active:bg-muted">
            <span class="min-w-0 flex-1">{{ g.name }}</span>
            <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        </li>
      </ul>
      <!-- Without the list nobody can pick a group, so a failed load says so and offers a retry. -->
      <div v-else-if="error && status !== 'pending'" class="mt-3 rounded-2xl border p-4" role="alert">
        <p class="text-base">
          The groups couldn't load. Check your signal.
        </p>
        <Button size="lg" class="mt-3 w-full" @click="refresh()">
          Retry
        </Button>
      </div>
      <div v-else class="mt-3 divide-y overflow-hidden rounded-2xl border" aria-busy="true">
        <div v-for="n in GROUP_COUNT" :key="n" class="flex min-h-14 items-center px-4">
          <Skeleton class="h-6 w-40" />
        </div>
      </div>
    </section>
  </main>
</template>
