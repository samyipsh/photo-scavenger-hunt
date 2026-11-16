<script setup lang="ts">
import { ExternalLinkIcon } from '@lucide/vue'
import { EVENT } from '~~/data/event'
import { TYPES } from '~~/data/guide'
import { passageTitle, passageUrl, type TypesOfChristPage } from '#shared/utils/typesOfChrist'

// The Types of Christ answers, from Help › Misc once the committee shows them. They come from the
// server (/api/types), never from the app's own files, so they can't be read before then.
useHead({ title: `${TYPES.title} · ${EVENT.appName}` })

// Loaded once: the answers don't change. Try again after a failed load keeps anything already
// showing (useLastGood); the committee hiding them again takes them away.
const { data: fresh, error, refresh, status } = await useFetch<TypesOfChristPage>('/api/types', { lazy: true, timeout: 15_000 })
const data = useLastGood(fresh, error)
const hidden = computed(() => (error.value as { data?: { data?: { code?: string } } } | null)?.data?.data?.code === 'types-hidden')

// A tapped reference shows its verses in a sheet, with the passage on BibleGateway at the bottom.
// The passage stays set as the sheet closes, so its title doesn't empty mid-slide.
const sheetOpen = ref(false)
const passage = ref('')
function showVerses(p: string) {
  passage.value = p
  sheetOpen.value = true
}
const verses = computed(() => data.value?.verses[passage.value] ?? [])
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <CommitteeHeader :title="TYPES.title" back="/help" />

    <p v-if="hidden" class="mt-4 text-base">
      Not shown yet.
    </p>
    <div v-else-if="error && !data" class="mt-8 text-center">
      <p class="text-base">
        Couldn't load. Check your signal.
      </p>
      <Button class="mt-3" :disabled="status === 'pending'" @click="refresh()">
        Try again
      </Button>
    </div>
    <div v-else-if="!data" class="mt-4 space-y-3" aria-busy="true">
      <Skeleton class="h-20 w-full rounded-2xl" />
      <Skeleton class="h-64 w-full rounded-2xl" />
    </div>

    <template v-else>
      <ScriptureText :text="data.intro" :verses="data.verses" class="mt-3 text-base" @open="showVerses" />

      <!-- Each type: its hint as on the puzzle card, how the hint matches, how it points to Christ,
           then the passages to read. -->
      <article v-for="t in data.types" :key="t.name" class="mt-8 border-t pt-6">
        <h2 class="text-xl font-bold leading-tight">
          {{ t.name }}
        </h2>
        <p class="mt-3 rounded-xl bg-primary/10 px-4 py-3 text-base italic">
          <template v-for="(line, i) in t.hint" :key="i">
            <br v-if="i > 0">{{ line }}
          </template>
        </p>
        <h3 class="mt-4 text-base font-bold text-primary">
          The hint
        </h3>
        <ScriptureText v-for="(p, i) in t.match" :key="`m${i}`" :text="p" :verses="data.verses" class="mt-1 text-base" @open="showVerses" />
        <h3 class="mt-4 text-base font-bold text-primary">
          The type
        </h3>
        <ScriptureText v-for="(p, i) in t.type" :key="`t${i}`" :text="p" :verses="data.verses" class="mt-1 text-base" @open="showVerses" />
        <ScriptureText :text="t.refs" :verses="data.verses" class="mt-3 text-base leading-8 text-muted-foreground" @open="showVerses" />
      </article>
    </template>

    <BottomSheet v-model:open="sheetOpen" :title="passageTitle(passage)" content-class="max-h-[85dvh]">
      <template #title>
        <DrawerTitle class="text-left text-xl font-bold leading-tight">
          {{ passageTitle(passage) }} <span class="text-base font-normal text-muted-foreground">KJV</span>
        </DrawerTitle>
      </template>
      <!-- Verse numbers only when there's more than one. -->
      <div class="min-h-0 overflow-y-auto overscroll-contain">
        <p class="text-base leading-relaxed">
          <template v-for="[n, text] in verses" :key="n">
            <b v-if="verses.length > 1" class="font-semibold tabular-nums text-primary">{{ n }}</b>{{ verses.length > 1 ? ' ' : '' }}{{ text }}{{ ' ' }}
          </template>
        </p>
      </div>
      <template #footer>
        <Button as="a" :href="passageUrl(passage)" target="_blank" rel="noopener" variant="outline" class="w-full">
          Open on BibleGateway <ExternalLinkIcon />
        </Button>
      </template>
    </BottomSheet>
  </main>
</template>
