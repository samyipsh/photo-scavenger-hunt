<script setup lang="ts">
import { XIcon } from '@lucide/vue'

// Every sheet that rises from the bottom: one header row (the title, or a slot with a back
// arrow or a photo before it, then the close X, all centred on one line), an optional line under
// the title, the content, and an optional footer for the sheet's main button. The footer stays
// pinned above the bottom edge while the content scrolls, so the button is never cut off.
// The 44 px X sits 10 px outside its 24 px icon and its strokes start 5 px inside the icon, so
// -mr-[15px] puts the painted X on the content's right edge.
// `dismiss` gives the X another job (a photo not yet sent: it asks, then discards), named by
// `dismissLabel`; the sheet then leaves Back to its owner, who should make Back do the same.
// Swiping it down still just closes it.
const props = defineProps<{ title: string, description?: string, contentClass?: string, dismiss?: () => void, dismissLabel?: string }>()
const open = defineModel<boolean>('open', { required: true })
// Back closes the sheet, as if it were a page of its own.
useBackClose(() => open.value && !props.dismiss, () => { open.value = false })
</script>

<template>
  <Drawer v-model:open="open">
    <DrawerContent :class="contentClass">
      <div class="mx-auto flex min-h-0 w-full max-w-lg flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div class="flex shrink-0 items-center gap-2 pb-2 pt-3">
          <div class="min-w-0 flex-1">
            <slot name="title">
              <DrawerTitle class="text-left text-xl font-bold leading-tight">
                {{ title }}
              </DrawerTitle>
            </slot>
          </div>
          <Button v-if="dismiss" variant="ghost" size="icon" class="-mr-[15px] shrink-0" :aria-label="dismissLabel ?? 'Close'" @click="dismiss">
            <XIcon class="size-6" />
          </Button>
          <DrawerClose v-else as-child>
            <Button variant="ghost" size="icon" class="-mr-[15px] shrink-0" aria-label="Close">
              <XIcon class="size-6" />
            </Button>
          </DrawerClose>
        </div>
        <DrawerDescription :class="description ? '-mt-1 shrink-0 pb-2 text-left text-base text-muted-foreground' : 'sr-only'">
          {{ description || title }}
        </DrawerDescription>
        <!-- A content root with `min-h-0 overflow-y-auto` scrolls here, under the pinned footer. -->
        <div class="flex min-h-0 flex-1 flex-col">
          <slot />
        </div>
        <div v-if="$slots.footer" class="shrink-0 pt-3">
          <slot name="footer" />
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
