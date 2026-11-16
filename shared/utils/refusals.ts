// Why the app refused a photo, or a page. Sent as `data.code` with every refusal the phone acts
// on, so the phone decides what to do from the code and never from the wording of a message.
export type RefusalCode =
  | 'already-sent' // this group sent the same file before (data also has photoId, challengeId)
  | 'sent-by-another-group'
  | 'group-limit' // the group has reached a photo limit
  | 'phone-blocked'
  | 'uploads-closed'
  | 'types-hidden' // the committee hasn't shown the Types of Christ answers yet
  | 'demo-full' // demo mode: the demo holds as many visitors' photos as it takes until tomorrow

export interface Refusal {
  code?: RefusalCode
  photoId?: string
  challengeId?: string | null
}
