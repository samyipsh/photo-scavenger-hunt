<script setup lang="ts">
import { ref, watch } from 'vue'

// Asks for the photographer's name, once per phone, for photo credits in the gallery.
const { name, asked, editing, save } = useUploaderName()
const draft = ref('')
const firstTime = ref(true)
watch(editing, (open) => {
  if (!open) return
  draft.value = name.value ?? ''
  firstTime.value = !asked.value
})

function close(open: boolean) {
  // Closing the first-time prompt counts as skipping it, so it isn't asked again.
  if (!open) {
    if (firstTime.value) save(null)
    else editing.value = false
  }
}
// Back skips it too.
useBackClose(editing, () => close(false))
</script>

<template>
  <Dialog :open="editing" @update:open="close">
    <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
      <DialogTitle>Your name, for photo credits</DialogTitle>
      <DialogDescription class="sr-only">
        Shown with your photos in the gallery.
      </DialogDescription>
      <form class="space-y-3" @submit.prevent="save(draft)">
        <Input v-model="draft" aria-label="Your name" autocomplete="given-name" autocapitalize="words" maxlength="40" enterkeyhint="done" class="h-12" />
        <div class="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" @click="firstTime ? save(null) : (editing = false)">
            {{ firstTime ? 'Skip' : 'Cancel' }}
          </Button>
          <Button type="submit" :disabled="!draft.trim() && firstTime">
            Save
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
