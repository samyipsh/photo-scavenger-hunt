<script setup lang="ts">
import { EyeOffIcon, ShieldAlertIcon, Trash2Icon } from '@lucide/vue'

// The judge's rarer actions on a photo, kept away from Counts and Doesn't count. The sheet is
// titled with the photo itself ("G3 · Lily"), so nothing is removed from the wrong one. Hide
// can be undone (Hidden photos); both permanent ones say "Delete" and are red. Inappropriate
// has a shield, not a flag: the flag is a station on committee home.
defineProps<{ busy?: boolean, thumbUrl?: string, identity?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ hide: [], inappropriate: [], delete: [] }>()
// As the reject sheet's rows: hairlines between them, the tap area spilling into the gutter, the
// 24 px icon column on the content edge.
const row = '-mx-3 flex min-h-12 w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium active:bg-muted disabled:opacity-50'
</script>

<template>
  <BottomSheet v-model:open="open" :title="identity || 'More'">
    <template #title>
      <div class="flex min-w-0 items-center gap-3">
        <img v-if="thumbUrl" :src="thumbUrl" alt="" class="size-11 shrink-0 rounded-lg bg-muted object-cover">
        <DrawerTitle class="min-w-0 truncate text-left text-xl font-bold leading-tight">
          {{ identity || 'More' }}
        </DrawerTitle>
      </div>
    </template>
    <ul class="divide-y">
      <li>
        <button type="button" :class="row" :disabled="busy" @click="emit('hide')">
          <EyeOffIcon class="size-6 shrink-0" /> Hide
        </button>
      </li>
      <li>
        <button type="button" :class="[row, 'text-destructive']" :disabled="busy" @click="emit('inappropriate')">
          <ShieldAlertIcon class="size-6 shrink-0" /> Delete as inappropriate
        </button>
      </li>
      <li>
        <button type="button" :class="[row, 'text-destructive']" :disabled="busy" @click="emit('delete')">
          <Trash2Icon class="size-6 shrink-0" /> Delete
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
