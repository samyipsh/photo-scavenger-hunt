<script setup lang="ts">
// Confirms deleting a photo for good: Delete in the judge's ⋯ menu, or from Hidden photos. The
// photo shows beside the title ("G3 · Lily"), as in every judge's confirmation, so the right one
// goes.
const open = defineModel<boolean>('open', { required: true })
useBackClose(open)
defineProps<{ thumbUrl?: string, identity?: string, busy?: boolean }>()
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
      <div class="flex min-w-0 items-center gap-3">
        <img v-if="thumbUrl" :src="thumbUrl" alt="" class="size-11 shrink-0 rounded-lg bg-muted object-cover">
        <div class="min-w-0">
          <DialogTitle>Delete this photo for good?</DialogTitle>
          <p v-if="identity" class="truncate text-base text-muted-foreground">
            {{ identity }}
          </p>
        </div>
      </div>
      <DialogDescription>It can't be undone.</DialogDescription>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="open = false">
          Keep it
        </Button>
        <Button variant="destructive" :disabled="busy" @click="open = false; emit('confirm')">
          Delete
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
