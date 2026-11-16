<script setup lang="ts">
import type { Overview } from '~/types/api'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { CheckIcon, CircleXIcon, CopyIcon, PencilIcon } from '@lucide/vue'
import { MAX_LEADER_LENGTH } from '#shared/utils/groups'

// The scores page's Groups tab: each group's link to copy, and its IC. The IC is a participant,
// shown in the group's name everywhere ("Group 1 (Adam)") and on the Need help page. The
// example group has none.
type GroupRow = Overview['groups'][number]
const props = defineProps<{ groups: GroupRow[] }>()
const emit = defineEmits<{ changed: [] }>()

// Example groups go last, so they're not copied by mistake.
const sorted = computed(() => [...props.groups].sort((a, b) => Number(a.hidden) - Number(b.hidden) || a.number - b.number))

// `editing` outlives the sheet, so its title doesn't change while it slides away. Saving an empty
// name clears the IC. The row shows the new name once it's saved, so there's nothing else to say.
const open = ref(false)
const editing = ref<GroupRow | null>(null)
const draft = ref('')
const saving = ref(false)
const problem = ref<string | null>(null)
const box = ref<{ $el: HTMLInputElement } | null>(null)
const unchanged = computed(() => draft.value.trim() === (editing.value?.leader ?? ''))
function edit(g: GroupRow) {
  editing.value = g
  draft.value = g.leader ?? ''
  problem.value = null
  open.value = true
}
watch(draft, () => {
  problem.value = null
})
// The old name is selected whenever the box gets the cursor, so typing replaces it.
function selectAll() {
  const el = box.value?.$el
  if (el?.value) setTimeout(() => el.setSelectionRange(0, el.value.length))
}
// Once the sheet is up, the cursor goes to the box.
watch(open, async (v) => {
  if (!v) return
  await nextTick()
  setTimeout(() => box.value?.$el.focus(), 50)
})
async function clearDraft() {
  draft.value = ''
  await nextTick()
  box.value?.$el.focus()
}
async function save() {
  const g = editing.value
  if (!g || unchanged.value) return
  saving.value = true
  try {
    await $fetch(`/api/committee/groups/${g.id}`, { method: 'POST', body: { leader: draft.value } })
    open.value = false
    emit('changed')
  }
  catch (err) {
    problem.value = errorText(err)
  }
  finally {
    saving.value = false
  }
}

// A copied link turns its button into a green tick for a moment. When the phone won't copy, the
// link shows under the row to long-press instead.
const linkOf = (g: GroupRow) => `${location.origin}/g/${g.token}`
const copied = ref<string | null>(null)
const showLink = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copiedTimer))
async function copyLink(g: GroupRow) {
  try {
    await navigator.clipboard.writeText(linkOf(g))
    showLink.value = null
    copied.value = g.id
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = null }, 2000)
  }
  catch {
    copied.value = null
    showLink.value = g.id
  }
}
</script>

<template>
  <!-- The row is the way to change the IC, with a pencil after the name to say so; the copy
       button is a quiet icon at its end, its icon's right edge on the card's 16 px inset. -->
  <ul class="divide-y overflow-hidden rounded-2xl border">
    <li v-for="g in sorted" :key="g.id">
      <div class="flex min-h-14 items-center gap-2 pr-1">
        <button
          v-if="!g.hidden" type="button" class="flex min-h-14 min-w-0 flex-1 flex-wrap items-center gap-x-2 py-2 pl-4 text-left text-base active:bg-muted"
          :aria-label="`Change Group ${g.number}'s IC${g.leader ? `, ${g.leader}` : ''}`" @click="edit(g)"
        >
          <span class="font-semibold">{{ g.name }}</span>
          <span v-if="!g.leader" class="font-medium text-primary">Add IC</span>
          <PencilIcon v-else class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <span v-else class="min-w-0 flex-1 py-2 pl-4 text-base font-semibold">{{ g.name }}</span>
        <Button
          variant="ghost" size="icon" class="shrink-0" :class="copied === g.id ? 'text-success hover:text-success' : 'text-muted-foreground'"
          :aria-label="`Copy ${g.name}'s link`" @click="copyLink(g)"
        >
          <CheckIcon v-if="copied === g.id" class="size-5" />
          <CopyIcon v-else class="size-5" />
        </Button>
      </div>
      <p class="sr-only" aria-live="polite">
        {{ copied === g.id ? `${g.name}'s link copied` : '' }}
      </p>
      <div v-if="showLink === g.id" class="px-4 pb-3 text-base" role="status">
        <p class="text-muted-foreground">
          Couldn't copy. Long-press the link:
        </p>
        <p class="select-all break-all">
          {{ linkOf(g) }}
        </p>
      </div>
    </li>
  </ul>

  <!-- A sheet, like every other edit, so it rises with the keyboard; Save is pinned at its foot. -->
  <BottomSheet v-model:open="open" :title="`Group ${editing?.number ?? ''}'s IC`">
    <form id="group-ic-form" @submit.prevent="save()">
      <div class="relative">
        <Input
          ref="box" v-model="draft" aria-label="IC's name" placeholder="First name" :maxlength="MAX_LEADER_LENGTH"
          autocomplete="off" autocapitalize="words" enterkeyhint="done" class="h-12 pr-12 text-lg" :aria-invalid="!!problem" @focus="selectAll"
        />
        <!-- Clears the box only; Save then removes the IC. -->
        <button
          v-if="draft" type="button" class="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground active:text-foreground"
          aria-label="Clear the name" @click="clearDraft()"
        >
          <CircleXIcon class="size-5" />
        </button>
      </div>
      <p v-if="problem" class="mt-2 text-base font-semibold text-red-800" role="alert">
        {{ problem }}
      </p>
    </form>
    <template #footer>
      <Button type="submit" form="group-ic-form" size="lg" class="w-full" :disabled="saving || unchanged">
        {{ saving ? 'Saving…' : 'Save' }}
      </Button>
    </template>
  </BottomSheet>
</template>
