<script setup lang="ts">
import 'vue-sonner/style.css'

// Toasts sit just above the group page's bottom bar there, above the judge's buttons (and the
// line over them) on the judge page, and near the bottom elsewhere, or above a bar a page puts
// there for a while (`toast-lift`: the Select bar in the gallery and Hidden photos).
const route = useRoute()
const toastLift = useState<number>('toast-lift', () => 0)
const toastOffset = computed(() => ({ bottom: route.path.startsWith('/g/') ? 104 : route.path === '/c/judge' ? 132 : Math.max(24, toastLift.value) }))

// Most feedback shows where the action happened; the few toasts left are a solid dark pill with
// 16 px text and no border, so they read as the app's own in the sun. Sonner colours a toast from
// these variables, set here on the toast itself; its Undo button takes them the other way round,
// light on the dark pill, and is rounded to match. The button keeps the 44 px, 16 px rule from
// components/ui/sonner, which these classes replace.
const toastOptions = {
  classes: {
    toast: '[--normal-bg:var(--foreground)] [--normal-text:var(--background)] [--normal-border:transparent] rounded-full! px-5! py-3! text-base! shadow-lg!',
    actionButton: 'h-auto! min-h-11! rounded-full! px-4! text-base! font-semibold!',
  },
}
</script>

<template>
  <NuxtRouteAnnouncer />
  <AppBar />
  <NuxtPage />
  <QuestNameDialog />
  <Toaster position="bottom-center" :duration="3000" :offset="toastOffset" :mobile-offset="toastOffset" :toast-options="toastOptions" />
</template>
