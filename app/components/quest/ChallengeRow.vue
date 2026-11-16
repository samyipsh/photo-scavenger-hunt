<script setup lang="ts">
import { CameraIcon, CheckCircle2Icon, Loader2Icon, XCircleIcon } from '@lucide/vue'
import type { QuestChallenge } from '~/types/api'
import type { ChallengeStatus } from '~/types/quest'

// A challenge in its kind's list; tapping it opens its sheet.
defineProps<{ challenge: QuestChallenge, status: ChallengeStatus, reason?: string | null }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <!-- A counted row is tinted green, so what's done stands out where it is in the list; a rejected
       one is a faint pink, since it needs another go. -->
  <div class="relative" :class="status === 'counts' ? 'bg-success-soft' : status === 'rejected' ? 'bg-destructive/5' : ''">
    <button
      type="button"
      class="flex min-h-14 w-full gap-3 px-3 py-3 text-left transition-colors active:bg-muted"
      :class="status === 'counts' ? 'items-center' : 'items-start'"
      @click="$emit('open')"
    >
      <!-- The 24 px icon column: a quiet camera for a challenge not shot yet. -->
      <span class="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
        <CheckCircle2Icon v-if="status === 'counts'" class="size-6 text-success" />
        <XCircleIcon v-else-if="status === 'rejected'" class="size-6 text-destructive" />
        <Loader2Icon v-else-if="status === 'uploading'" class="size-6 animate-spin text-muted-foreground" />
        <CameraIcon v-else class="size-5 text-muted-foreground" />
      </span>
      <!-- Points sit on the title line, so the hint gets the row's full width. -->
      <span class="min-w-0 flex-1">
        <span class="flex items-baseline justify-between gap-2">
          <span class="text-base font-semibold leading-snug">{{ challenge.title }}</span>
          <!-- Points stand out, since they're the reason to go for a challenge. -->
          <QuestPointsPill v-if="challenge.points" class="-mt-0.5" :points="challenge.points" :earned="status === 'counts'" :rejected="status === 'rejected'" />
        </span>
        <span v-if="status === 'rejected'" class="block text-base font-medium text-destructive">Doesn't count: {{ reason || 'Doesn\'t match the challenge' }}</span>
        <span v-else-if="status === 'uploading'" class="block text-base text-muted-foreground">Sending…</span>
        <!-- A counted row is one line: the green tick already says so. The full hint is in the sheet. -->
        <span v-else-if="challenge.hint && status !== 'counts'" class="line-clamp-2 text-base text-muted-foreground">{{ challenge.hint }}</span>
      </span>
      <!-- The other two states say themselves in words. -->
      <span v-if="status === 'counts' || status === 'todo'" class="sr-only">{{ status === 'counts' ? 'Counts' : 'Not done yet' }}</span>
    </button>
  </div>
</template>
