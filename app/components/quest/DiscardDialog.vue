<script setup lang="ts">
// Asked before a camera photo that hasn't been sent is dropped (usePhotoDiscard): it isn't in
// the phone's own photos, so it would be gone. The photo is right behind the question, so it
// isn't shown again here.
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ discard: [] }>()
useBackClose(open)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
      <DialogTitle>Discard this photo?</DialogTitle>
      <DialogDescription class="sr-only">
        A photo taken here isn't saved in your phone's photos.
      </DialogDescription>
      <div class="grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" @click="open = false">
          Keep
        </Button>
        <Button size="lg" variant="destructive" @click="emit('discard')">
          Discard
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
