// A dialog over the whole screen, on white like the photo view: the photo check and its crop
// share it, so the photo sits in the same place in both. It closes at once, with no fade, so a
// photo never blinks out while it goes.
export const FULL_SCREEN_DIALOG = 'top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:animate-none'
