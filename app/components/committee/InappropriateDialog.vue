<script setup lang="ts">
import { ref, watch } from 'vue'

// Confirms deleting a photo as inappropriate, with the option to stop that phone uploading. Like
// every permanent deletion it says "Delete", and the photo shows beside the title, so the judge
// knows which one goes.
const open = defineModel<boolean>('open', { required: true })
useBackClose(open)
defineProps<{ groupName: string, thumbUrl?: string, identity?: string }>()
const emit = defineEmits<{ confirm: [block: boolean] }>()

const block = ref(false)
watch(open, (v) => {
  if (v) block.value = false
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
      <div class="flex min-w-0 items-center gap-3">
        <img v-if="thumbUrl" :src="thumbUrl" alt="" class="size-11 shrink-0 rounded-lg bg-muted object-cover">
        <div class="min-w-0">
          <DialogTitle>Delete as inappropriate?</DialogTitle>
          <p v-if="identity" class="truncate text-base text-muted-foreground">
            {{ identity }}
          </p>
        </div>
      </div>
      <DialogDescription>It can't be undone.</DialogDescription>
      <label class="flex min-h-14 items-start gap-3 rounded-xl border p-3">
        <Checkbox v-model="block" class="size-6 rounded-md border-2 [&_svg]:size-4" />
        <span class="text-base">
          <span class="block font-semibold">Also block this phone</span>
          <span class="block text-base text-muted-foreground">Other phones in {{ groupName }} can still upload.</span>
        </span>
      </label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="open = false">
          Keep it
        </Button>
        <Button variant="destructive" @click="open = false; emit('confirm', block)">
          {{ block ? 'Delete and block' : 'Delete' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
