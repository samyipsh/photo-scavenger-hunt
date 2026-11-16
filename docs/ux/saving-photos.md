# Saving photos from the gallery: research and decisions

Decided on 5 Nov 2026 with the organiser, after reviews by Opus and Codex.

## What people can do

- **Start picking:** tap **Select** (nothing ticked yet) or hold a photo for half a second (it starts ticked). Taps then tick and untick.
- **Look before ticking:** while picking, the expand icon in a photo's corner (where the heart sits) opens it full size, with **Select / Selected** in its top bar in place of the photo's edit buttons; closing it keeps the ticks. Outside picking the full-size view has no tick.
- **Select all:** in the header while picking, beside Cancel. It ticks every photo under the current filters, loading any pages not shown yet, and only if they all loaded. Once they're all ticked it reads **Deselect all**, which unticks just those. Disabled when there are no photos.
- **Ticks carry across filters**, on purpose (a few from each group). The header always shows the total ("64 selected"). Leaving the gallery clears them.
- **Save:**
  - **iPhone and iPad:** the share sheet ("Save 30 Images" puts them in Photos), 30 at a time, in the order they were ticked. Each save unticks what it shared; the button then reads "Save 30 of 34", then "Save 4 photos".
  - **Android and computers:** one tap downloads every ticked photo: three at a time, each handed to the browser before the next starts, so only a few wait in memory. A line first says "Allow downloads if asked." Afterwards the ticks stay, with "Downloads started" and how to allow downloads if some are missing; **Done** finishes.
  - **Over 30 ticked:** a note that an album of every photo will be shared after the event.
- **Cancel** is allowed at any time, including during a save: it stops the downloads, clears every tick and leaves picking.
- **Back** (Android's Back, iPhone's swipe back):
  1. With a photo open full size: closes the photo; still picking.
  2. Picking, no save running: leaves picking and clears the ticks, like Cancel, without asking.
  3. A save running: doesn't stop it; asks "Stop saving? 12 photos are still downloading." with **Keep saving** and **Stop**.
  4. After "Downloads started" (Android, nothing running, the ticks kept only in case the browser blocked some): the same as tapping Done.
  The filters stay as they are after Back, even if they changed while picking.
- **Leaving the page during a save** (the menu, a link): the same "Stop saving?" question; **Stop** then goes on. Closing the tab gets the browser's own prompt where it has one (Android Chrome; iPhone Safari shows none). Leaving when no save is running just clears the ticks.
- **Files are named** like `G3-Swan-0952-Ethan.jpg`: group, what it is, time, photo credit.
- **The gallery shows every photo**, laid out by challenge for one group, with no "×2" grouping, so "15 photos" opens 15 photos and each tick is one photo you can see.

## Research

**Entry points.** Material's selection pattern starts selection with a long press and then lets taps toggle ([Material](https://m2.material.io/design/interaction/selection), [Material 1](https://m1.material.io/patterns/selection.html)). iPhone Photos uses a Select button, with Select All only inside an album ([iDownloadBlog](https://www.idownloadblog.com/2015/10/07/select-multiple-images-photos/)). Google Photos has no global select all; it ticks a whole day from its heading ([Technobezz](https://www.technobezz.com/how-to-select-all-photos-in-google-photos)). So: both entry points, and Select all inside select mode.

**Select all with paging.** A bare "Select all" is ambiguous when some results aren't loaded ([PatternFly](https://www.patternfly.org/patterns/bulk-selection/), [SaaSFrame](https://www.saasframe.io/patterns/bulk-actions), [NN/g](https://www.nngroup.com/videos/bulk-actions-design-guidelines/)). Ours loads every page of the filter first, so "all" means all.

**Carrying ticks across views.** Most photo apps clear the selection when you leave a view; keeping it is a basket model, which only works when the total is always visible. The organiser chose to keep them; the header count is the cue.

**Batch limits.** Apps cap one action and make you do the next lot yourself: WhatsApp sends up to 100 photos per message (30 before 2023) ([The Quint](https://www.thequint.com/tech-and-auto/tech-news/whatsapp-rolls-out-new-feature-to-share-up-to-100-photos-videos-all-at-once)); Google Photos on the web downloads up to 500 as a zip ([Technipages](https://www.technipages.com/google-photos-how-to-download-multiple-images)); iCloud.com up to 1,000 ([Apple Community](https://discussions.apple.com/thread/256205543)). None found keeps the rest queued, which ours does: the ticks stay and the next tap takes the next 30.

**Why 30, and why not one tap for everything on iPhone.** An independent Opus checked WebKit's source:
- `navigator.share()` needs a recent tap and uses it up; tapping inside the share sheet isn't a new tap for the page, so a page can't open the next sheet by itself ([WebKit](https://webkit.org/blog/13862/the-user-activation-api/), [bug 239832](https://bugs.webkit.org/show_bug.cgi?id=239832)). One tap streaming every batch works on Android, not iPhone.
- Opening the sheet copies every file in memory again ([ShareDataReader](https://webkit.googlesource.com/WebKit/+/master/Source/WebCore/page/ShareDataReader.cpp)). 30 photos is about 30 MB plus the copy; 300 risks the tab crashing and losing every tick.
- Outdoors at 5–10 Mbps, 30 photos take about 20–40 s; 100 take 1–2.5 min with nothing saved until the end.

**Why not a zip.** On iPhone a zip lands in the Files app, not Photos, and Android's gallery doesn't look inside zips. Built on the phone, it holds every photo in memory at once; built on the server, every photo would pass through the Worker (128 MB shared by everyone), breaking the rule that keeps uploads safe. A zip suits a computer, which is what the post-event album export is for.

**Android's multiple-download prompt.** Chrome lets the first download through and asks "Download multiple files?" for the rest. Allow is remembered; **Block is remembered too and drops later downloads silently**, and the page can't tell ([Chromium](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/download/download_request_limiter.cc)). Hence the "Allow downloads if asked" line and keeping the ticks until Done.

**Cancel.** Disabling it would remove the only way out of a long wait: Nielsen puts attention at about 10 s and asks for a clear emergency exit ([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)); Apple's guidance is to offer Cancel when stopping has no bad side effects ([HIG](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)). On Android nothing confirms a save, so a mistaken "Save 300" would mean minutes and hundreds of MB. Codex preferred disabling it for simplicity; we kept it, since it shares the abort the timeout needs.

**Back while selecting.** Android's selection pattern: Back dismisses the selection bar and clears the selection, as Done does; the action mode also ends when everything is unticked ([Android selection pattern](https://stuff.mit.edu/afs/sipb.mit.edu/project/android/docs/design/patterns/selection.html), [DZone](https://dzone.com/articles/contextual-action-bar-cab), [CodePath](https://guides.codepath.com/android/Menus-and-Popups)). Material 3's contextual bars pair a close icon with Back exiting selection ([Compose contextual app bar](https://klibs.io/project/aldefy/compose-contextual-appbar)). Google Photos, Gmail and Files clear without asking. Picking adds a history entry at the same address, as the photo view does; Back takes it off, and the gallery reads its filters from the address only on load, so it puts the current filters back.

**Leaving during work in progress.** Web apps warn before leaving only while something is actually running, and the warning confirms rather than blocks ([Chrome developers on beforeunload](https://dev.to/chromiumdev/sure-you-want-to-leavebrowser-beforeunload-event-4eg5)).

**Deleted photos.** R2 answers a missing photo without CORS headers, so the page only sees "failed to fetch" (checked on staging) and can't tell it from no signal. After a failed save the app asks its own gallery API about each failed photo: gone ones are dropped from the ticks, the rest get fresh links and go to the back of the queue so they can't block later saves.

## Robustness decisions

- Downloads run three at a time, each with a 30 s no-progress timer (reset as bytes arrive). The first stall stops every photo of that save still missing, so a dead connection ends the save in about 30 s instead of spinning; the photos that arrived are saved and only the failed ones stay ticked.
- Checking failed photos with the app: three at a time, 8 s each, no retry, and no more once the app can't be reached.
- A save holds the ticks until it has fully finished, checks included. Only photos whose own download failed are checked with the app (a deleted photo fails fast; a stalled or stopped one isn't checked), and the checking stops after three in a row are still there. When nothing could be saved, picking stays open with the note instead of closing.
- On Android, if some photos failed, the ones handed to the browser are unticked so saving again fetches just the failed ones; if none failed, every tick stays (in case the browser blocked some).
- Select all says so if some pages couldn't load ("Couldn't load every photo…") and ticks nothing; Save waits for it.
- The bar's height sets the grid's bottom padding, so the last row scrolls clear of any notes.
- A hold counts only the first finger or main mouse button, and Save ignores a tap within 0.8 s of the finger lifting from a hold (the guard ends after 5 s whatever happens).
- Picking's history entry is added only on a tap: Select, the finger lifting from a hold, "Keep saving". When there's no tap to hand (a hold that turned into a scroll, Escape on the question, a save ending while it was up), it waits for the next tap on the page (`navigator.userActivation` says which). Chrome lets Back skip an entry a page adds without a tap, and marks the page behind it skippable. Back during a save asks without re-adding it. A second Back then answers "Keep saving" on Android, where Back closes the question; on an iPhone it's a plain leave, which asks too.
- After a link during a save, the page carries on only if the save saved everything it tried; a closed share sheet, "Ready" or failures keep you on the gallery with your ticks.
- Only the next batch downloads ahead while picking, so a big selection doesn't fill the phone's memory.
- While a save is getting photos, ticks and Select all are locked; Cancel and leaving the page abort it, and nothing opens or downloads afterwards.
- If the wait used up the iPhone's tap, the button reads "Ready · Save …"; that tap shares the files already in hand, with no network wait. If sharing is refused again, it says so instead of offering Ready forever.
- The share sheet is used only on an iPhone or iPad whose browser can share files (`navigator.canShare({ files })`); everything else downloads, including Android Chrome, whose share sheet has no plain save.

## Not doing

- Drag to select, a tick per section, a screen listing what's ticked, and a separate Stop button: more controls than the event needs.
- A byte cap per batch (Codex suggested 45 MB): photos are about 1 MB; revisit if a real phone struggles with 30.
- A server endpoint returning every matching photo for Select all: pages load in a second or two, so a photo shifting between pages is unlikely.
- Keeping the address in step after a long-press history jump to another page during a save (Codex): rare, and the cost is a stale address, never lost photos; fixing it means tracking the router's own history positions.
- Saving in the background while browsing other pages, as uploads do: only Android could finish (an iPhone needs a tap on the gallery for each share sheet), and it needs its own status in the top bar. A save takes under a minute, so asking before leaving covers it.

## Still to check on real phones before live

- iPhone (iOS 17 and 18): hold, including near the bottom of the screen; "Save 30 Images" appears and they reach Photos.
- Android: Chrome and Samsung Internet, saving 5, Allow and Block.
- Already checked in WebKit (Playwright, against staging's real R2): the fetch needs no preflight, a photo first opened full size still downloads, and the share gets real JPEGs. The bucket rule also allows `cache-control` and `pragma` as insurance.
- Also try Chrome on iPhone (may not share files, so it downloads), and an in-app browser (Telegram, Instagram), where blob downloads may do nothing.
- Back with the system Back or edge swipe (Android Chrome, iPhone Safari): hold, expand, swipe back (still picking); hold, let the finger drift into a scroll, then tap a photo's expand icon and press Back (still picking); Back during a save, then Back again (Android: closes the question and keeps saving; iPhone: asks again); Back with no save running (leaves picking).
- iPhone: `navigator.share` resolves after "Save Images" (if it rejects, the ticks stay and people save twice), and still settles if they switch apps from the sheet.
- Then the live bucket's CORS rule (adding GET) goes on **before** the app is deployed: without it every save says "didn't download". `check:api` can't catch it.
