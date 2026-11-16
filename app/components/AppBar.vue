<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useOnline } from '@vueuse/core'
import { AlertTriangleIcon, ImagesIcon, LifeBuoyIcon, Loader2Icon, MenuIcon, PencilIcon, ShieldIcon, TrophyIcon, UsersIcon, WifiOffIcon, XIcon } from '@lucide/vue'
import { EVENT } from '~~/data/event'

// One bar on every page: the app name, which goes home, and a menu with everywhere else.
// New pages get a line in `items`.
const route = useRoute()
const { loggedIn, user, fetch: fetchSession } = useUserSession()
const isCommittee = computed(() => loggedIn.value && (user.value as { role?: string } | null)?.role === 'committee')
onMounted(() => fetchSession())

const open = ref(false)
// Back closes the menu.
useBackClose(open)
const mine = ref<MyGroup | null>(null)
// The group page remembers this phone's group, so read it afresh whenever the menu opens.
watch(open, (v) => {
  if (v) mine.value = readMyGroup()
}, { immediate: true })
// A page that holds a navigation back (the gallery asking "Stop saving?") closes the menu too,
// so the question isn't hidden behind it.
const router = useRouter()
const offRefused = router.afterEach((_to, _from, failure) => {
  if (failure) open.value = false
})
onBeforeUnmount(offRefused)
watch(() => route.fullPath, () => {
  open.value = false
})

// A signed-in committee member's own work comes straight after their group.
const items = computed(() => [
  mine.value
    ? { to: `/g/${mine.value.token}`, label: mine.value.name, sub: null, icon: UsersIcon }
    : { to: '/', label: 'Choose your group', sub: null, icon: UsersIcon },
  ...(isCommittee.value ? [{ to: '/c', label: 'Committee', sub: null, icon: ShieldIcon }] : []),
  { to: '/gallery', label: 'Gallery', sub: null, icon: ImagesIcon },
  { to: '/scoreboard', label: 'Scoreboard', sub: null, icon: TrophyIcon },
  { to: '/help', label: 'Help', sub: null, icon: LifeBuoyIcon },
])
const uploader = useUploaderName()
// Photos still sending from a group page this phone has left: a way back to watch them finish,
// or to deal with one that was refused.
const online = useOnline()
const sendingElsewhere = computed(() => {
  const u = uploadsInFlight.value
  if (!u.token || route.path === `/g/${u.token}` || (u.count === 0 && u.failed === 0)) return null
  const state = u.failed > 0 ? 'attention' : !online.value ? 'offline' : u.stuck ? 'stuck' : u.waiting ? 'offline' : 'sending'
  const n = (k: number) => `${k} ${k === 1 ? 'photo' : 'photos'}`
  // A short word at every width ("2 waiting"); the whole sentence for screen readers.
  const pill = {
    attention: { text: `${u.failed} ${u.failed === 1 ? 'needs' : 'need'} you`, said: `${n(u.failed)} ${u.failed === 1 ? 'needs' : 'need'} you` },
    stuck: { text: `${u.stuck} stuck`, said: `${n(u.stuck)} not sending` },
    offline: { text: `${u.count} waiting`, said: `No signal: ${n(u.count)} waiting` },
    sending: { text: `Sending ${u.count}`, said: `Sending ${n(u.count)}` },
  }[state]!
  return { ...u, state, ...pill }
})
// The app name goes to the phone's own group when it has one; Change group in the menu goes home.
const homeLink = ref('/')
watch(() => route.fullPath, () => {
  const g = readMyGroup()
  homeLink.value = g ? `/g/${g.token}` : '/'
}, { immediate: true })
function editName() {
  open.value = false
  setTimeout(() => { uploader.editing.value = true }, 250)
}
// A station score that hasn't saved yet, shown on every page but its own station's and committee
// home (both say it just below), so an IC who has moved on to judging still knows. It saves by
// itself when the signal comes back. "1 unsaved" or "1 waiting" fits beside the app name even at
// 360 px.
const scoreWaiting = computed(() => {
  const q = scoreQueueStatus.value
  if (!q || route.path === '/c' || route.path === `/c/station/${q.stationId}`) return null
  return { ...q, text: `${q.count} ${q.kind === 'waiting' ? 'waiting' : 'unsaved'}` }
})
const isHere = (to: string) => to === '/c' ? route.path === '/c' : route.path === to
</script>

<template>
  <!-- Title, pill and menu fit at 360 px: the 328 px of content holds the 147 px title, an 8 px
       gap, a pill up to 139 px, a 4 px gap and the menu's 30 px (44 less its 14 px pull). The
       pill may also shrink and cut its word short, so it never makes the page wider than the
       screen. -->
  <header class="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
    <NuxtLink :to="homeLink" class="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-lg font-semibold">
      {{ EVENT.appName }}
    </NuxtLink>
    <div class="flex min-w-0 items-center gap-1">
      <!-- Pills are 32 px to see, inside a 44 px tap area. -->
      <NuxtLink
        v-if="scoreWaiting" :to="scoreWaiting.to" aria-live="polite" :aria-label="scoreWaiting.label"
        class="inline-flex min-h-11 min-w-0 items-center"
      >
        <span class="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-base font-medium">
          <WifiOffIcon v-if="scoreWaiting.kind === 'waiting'" class="size-4 shrink-0 text-warning" /><AlertTriangleIcon v-else class="size-4 shrink-0 text-warning" />
          <span class="truncate">{{ scoreWaiting.text }}</span>
        </span>
      </NuxtLink>
      <NuxtLink
        v-else-if="sendingElsewhere" :to="`/g/${sendingElsewhere.token}`" aria-live="polite" :aria-label="sendingElsewhere.said"
        class="inline-flex min-h-11 min-w-0 items-center"
      >
        <span
          class="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-base font-medium"
          :class="sendingElsewhere.state === 'sending' ? 'bg-muted' : 'bg-warning-soft'"
        >
          <AlertTriangleIcon v-if="sendingElsewhere.state === 'attention' || sendingElsewhere.state === 'stuck'" class="size-4 shrink-0 text-warning" />
          <WifiOffIcon v-else-if="sendingElsewhere.state === 'offline'" class="size-4 shrink-0 text-warning" />
          <Loader2Icon v-else class="size-4 shrink-0 animate-spin" />
          <span class="truncate">{{ sendingElsewhere.text }}</span>
        </span>
      </NuxtLink>
      <!-- The 44 px button keeps its full tap area; the margin only moves it. The 20 px icon sits
           12 px inside the button, and the bars end about 2.5 px inside the icon, so -mr-3.5 puts
           the bars' right end on the content edge, as the title's first letter is on the left. -->
      <Button variant="ghost" size="icon" class="-mr-3.5 size-11 shrink-0" aria-label="Menu" aria-haspopup="dialog" @click="open = true">
        <MenuIcon class="size-5" :stroke-width="1.75" />
      </Button>
    </div>
  </header>

  <Drawer v-model:open="open">
    <DrawerContent>
      <div class="mx-auto w-full max-w-lg px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <!-- No visible title: the list says what it is. -->
        <DrawerHeader class="sr-only">
          <DrawerTitle>Menu</DrawerTitle>
          <DrawerDescription>Go to another part of the app.</DrawerDescription>
        </DrawerHeader>
        <div class="relative">
          <!-- The X sits in from the sheet's corner: its 44 px button 8 px below the sheet's top and
               10 px in from its right edge, so its strokes clear the rounded corner. The rows start
               below the button, so a tap near the first row's end still opens it. -->
          <DrawerClose as-child>
            <Button variant="ghost" size="icon" class="absolute -right-1.5 -top-[13px] z-10" aria-label="Close">
              <XIcon class="size-6" />
            </Button>
          </DrawerClose>
          <!-- Rows reach 12 px past the content edge so their icons sit on it. -->
          <nav class="grid gap-1 pt-8">
            <NuxtLink
              v-for="i in items" :key="`${i.to}-${i.label}`" :to="i.to"
              class="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 active:bg-muted"
              :class="isHere(i.to) ? 'bg-muted' : ''"
              :aria-current="isHere(i.to) ? 'page' : undefined"
            >
              <component :is="i.icon" class="size-6 shrink-0 text-primary" />
              <span class="flex-1 text-lg font-semibold leading-tight">{{ i.label }}</span>
            </NuxtLink>
          </nav>
        </div>
        <!-- Quieter, below a line: the name for photo credits, and the committee's way in. The
             pencil and its text keep the rows' icon and text columns. -->
        <div class="mt-2 flex items-center justify-between gap-3 border-t pt-2">
          <button type="button" class="-ml-3 inline-flex min-h-11 min-w-0 items-center gap-3 rounded-xl pl-3 pr-2 text-base text-muted-foreground active:bg-muted" @click="editName">
            <span class="flex size-6 shrink-0 items-center justify-center" aria-hidden="true"><PencilIcon class="size-4" /></span>
            <span class="truncate">{{ uploader.name.value ? `Photo credit: ${uploader.name.value}` : 'Photo credit: Add name' }}</span>
          </button>
          <NuxtLink v-if="!isCommittee" to="/c" class="inline-flex min-h-11 shrink-0 items-center text-base font-medium text-primary">
            Committee
          </NuxtLink>
        </div>
      </div>
    </DrawerContent>
  </Drawer>

</template>
