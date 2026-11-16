<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { ref, watch } from 'vue'

// Why a photo doesn't count: the reasons that fit its challenge as one list, and a reason of the
// judge's own. The photo shows in the header ("G3 · Lily"), so the reason lands on the right one.
// The group sees the reason, which keeps judges kind; the box's placeholder says so.
defineProps<{ reasons: string[], busy?: boolean, thumbUrl?: string, identity?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ reject: [reason: string] }>()
const other = ref('')
watch(open, (v) => {
  if (v) other.value = ''
})
</script>

<template>
  <BottomSheet v-model:open="open" title="Why doesn't it count?">
    <template #title>
      <div class="flex min-w-0 items-center gap-3">
        <img v-if="thumbUrl" :src="thumbUrl" alt="" class="size-11 shrink-0 rounded-lg bg-muted object-cover">
        <div class="min-w-0">
          <DrawerTitle class="text-left text-xl font-bold leading-tight">
            Why doesn't it count?
          </DrawerTitle>
          <p v-if="identity" class="truncate text-base text-muted-foreground">
            {{ identity }}
          </p>
        </div>
      </div>
    </template>
    <!-- Each reason is a row to tap: hairlines between them and a red X in the 24 px icon column.
         The tap area spills into the gutter; the icon stays on the content edge. -->
    <ul class="divide-y">
      <li v-for="r in reasons" :key="r">
        <button
          type="button"
          class="-mx-3 flex min-h-12 w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium active:bg-muted disabled:opacity-50"
          :disabled="busy" @click="emit('reject', r)"
        >
          <XIcon class="size-6 shrink-0 text-destructive" aria-hidden="true" />{{ r }}
        </button>
      </li>
    </ul>
    <!-- The judge's own reason, pinned above the keyboard while they type. -->
    <template #footer>
      <form class="flex gap-2" @submit.prevent="other.trim() && emit('reject', other.trim())">
        <Input v-model="other" placeholder="Reason for the group" aria-label="Other reason" maxlength="120" enterkeyhint="done" class="h-12 text-lg" />
        <Button type="submit" size="lg" :disabled="!other.trim() || busy">
          Save
        </Button>
      </form>
    </template>
  </BottomSheet>
</template>
