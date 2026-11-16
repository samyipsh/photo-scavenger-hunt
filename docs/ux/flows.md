# User flows

Every screen, by a short code (G for the group page, S for station ICs, J for judging, L for the lead, E for everyone). Shots are 390 × 844 unless the name ends in `-360`.

## The setting

- One church outing: Sat 14 Nov 2026, Singapore Botanic Gardens, about 30 people in 5 groups.
- Outdoors, bright sun, weak signal at times. Nobody has seen the app before the morning.
- Six 20-minute rounds from 9:45: five game stations and a photo walk. Photos are taken throughout.
- **Scoring:**
  - Stations rank the groups: 300 points for first, down to 60.
  - The photo quest adds each challenge's own points (10–80), once per group.
  - Each award race gives its leader a prize: Most animals spotted +300, Most flower colours +200, Most photos +100. Tied groups each get it. Most liked photo +100 was dropped after the outing; likes only sort the gallery.
  - A group's photo points are its challenge points plus the prizes it holds.

## Owner's choices (not up for review)

- The menu opens as a sheet from the bottom. The app name "Photo Quest" is in the top bar.
- Photo points get weight: the big green number on the group page, and green points pills.
- Photos count unless a judge rejects them, so "not checked" stays quiet.
- Unliked hearts are bare; only this phone's like is filled.
- "How it works" sits under the header in three lines: send photos for the challenges to score points; get as many of you in each photo as you can, enjoy the moment together and create memory keepsakes; anyone in your group can send. Its X closes it on that phone for good. It's hidden while the phone can't send.
- The group's first photo is explained at the briefing; there's no button for it, just its row, first under Stations.
- Spot it starts with Any animal and Any flower: rows like the challenges', each with a gold badge for its icon, its race's prize, "Most animals spotted wins", then where the group stands and its count in plain grey ("Leading · 5 found", "3 behind · 0 of 9 found", or "0 found" before anyone has one). A tap opens the race's sheet (G05b), as a challenge row does. When the phone can't send, they stay, with a lock.
- Help lists only the organiser's number, as plain text to copy.
- Light theme everywhere. A group's scoreboard breakdown opens in place.
- No overall place on the group page, no countdown, no progress bar.
- **Words:**
  - Verdicts read "Counts" and "Doesn't count: reason".
  - The award races are "Most animals spotted", "Most flower colours" and "Most photos"; the photos for the first two are filed as "Animals spotted" and "Flower colours".
  - Kinds of challenge run in this order: Stations, Spot it, Group shots, Drama, Awards.

## Getting around

- **Back.** Android's Back closes whatever is open over the page, top first: a sheet's second step, a question, cropping (no change), a photo not yet sent (its X: from the camera it asks "Discard this photo?", from the phone it just goes), a sheet, the menu, the full-size photo. Only then does it leave the page. On iPhone, swipe back closes the full-size photo and leaves picking; sheets close by swiping down or with the X, as usual there.
- **E06, E06b: top bar and menu.**
  - The app name on the left goes to the phone's group page. The menu icon is on the right.
  - A status pill can sit beside the name: "Sending 3", "3 waiting", "1 needs you", or a station IC's "1 unsaved".
  - The menu has the phone's group, Committee (for signed-in members), Gallery, Scoreboard and Help. Change group is on the Help page, not here.
  - At the bottom: "Photo credit: Mei" with a pencil, and Committee sign-in.
  - Its X sits in from the sheet's top-right corner, just below the handle, above the first row.
- **E06c, E06d: Help.**
  - "Wrong group? Change group" first, with a swap icon, when this phone has a group: it goes to the group list.
  - "Questions? Ask Carl, your group's IC".
  - "Lost?" with a map pin, and "Emergency? Call 995".
  - The committee and where to find them, with the organiser's number on their line.
  - Misc: "Participant guide" with a chevron, then "Types of Christ" once the committee shows them (no row, and no hint of one, before), then any pages and PDFs outside the app from `DOCUMENTS` in `data/event.ts`, each opening in a new tab.
- **E07: Participant guide** (`/guide`, from Help).
  - The back chevron and title, as on committee pages; back goes to Help.
  - "Sat 14 Nov · Singapore Botanic Gardens", then "Between stations, do the photo quest in the app."
  - Timeline: each time on the left of a rail with a dot, the rounds' dot filled. A place under its line, green with a pin, opens Google Maps.
  - Scoring: "Each station ranks the five groups.", then each place's points as a column to scale (1st 300 down to 5th 60, points above, place below, as on the guide site), "Tied groups split their places' points, so two tied for first get 270 each.", then the photo points and the winner, in the committee's words from `data/guide.ts`.
- **E08, E08b, E08c: Types of Christ** (`/types`, from Help once shown).
  - The intro, then each type under a line: its name, its hint in a soft green box (in italics, a line each as on the puzzle card), "The hint" (how it matches), "The type" (how it points to Christ), and the passages to read in grey.
  - Bible references are green, underlined links. A tap opens a sheet (E08b): "Exodus 14:13–31 KJV", the verses with green numbers (none for a single verse), scrolling under a pinned "Open on BibleGateway".
  - Opened while hidden (an old link): "Not shown yet." (E08c). A first load that fails: "Couldn't load. Check your signal." with Try again.
- **E05, E05b: home.**
  - "Choose your group" and the groups as a list.
  - A remembered group gets "Continue as Group 3 (Carl)", with the name from the group list; a group that no longer exists drops the button.
  - If loading fails: Retry.
  - The Recce Team's example photos are here but don't score (G19).
- **Sheets:** a small handle and a plain dim behind them. The main button is pinned at the bottom.

## Who can change a photo

Only the phone that sent a photo and the committee can change it. Another phone, even in the same group, can only like it. That phone finds its own under My photos in the gallery (E03). In the committee's words, Hide can be undone and Delete can't.

| | The phone that sent it | The committee |
| --- | --- | --- |
| Move it to another challenge | Yes (E04d); a judge checks it again | Yes, when judging (J03) or from the photo view |
| Say it doesn't count, or that it does | No | Yes (J01, E04b) |
| Hide it: out of the gallery, files kept | No | Hide, in the judge's ⋯ menu (J08) or the gallery's Select (E03g); it goes to Hidden photos (J14) |
| Put it back in the gallery | No | Unhide, from Hidden photos (J14, E04h) |
| Delete it for good, files and all | Its bin (E04e), with no way back | Delete, or Delete as inappropriate (J08–J10), or Delete for good from Hidden photos (J14) |
| Stop the phone sending | No | Delete as inappropriate can block it (J09); Unblock in Controls (L03c) |

## Group page

- **G01, G02: before the rounds.**
  - "How it works" until this phone closes it; "Your group's first photo" is the first row under Stations.
  - The card shows "First stop · 9:45 am".
- **G03: during a round.**
  - The header has the group's name, then one line: "44 photos ›" (opens its photos by challenge) and the photo points in green, "160 pts ›" (challenges plus any award prizes held; opens the scoreboard breakdown).
  - A refresh that can't get through keeps the page as it was, cameras included, with "No signal · may be out of date" and a retry icon under the header. Not while photos are waiting to send: the bar at the bottom says so then.
  - The rotation card shows "Stop 2 of 6 ⌄", the station and its place with a map pin, and, below a rule, "Next 10:25 am · One-syllable poetry". The photo walk has no place: its line reads "Roam anywhere and take photos", with no pin.
- **G03b:** if the committee moves the round times, every card follows within 30 seconds.
- **G03c:** tapping "Stop 2 of 6" opens the group's six stops in the card instead: stops already done are just their time and name, greyed; "Now" is grey-tinted; the rest have their time, place and map pin (the photo walk has none); then "Back to Trellis Garden gazebo", which is "Now" during the roundup.
- **G04, G04b: challenge lists.**
  - Tiles in two rows: "Stations 0/7" and "Spot it 9/19" in halves, then "Group shots", "Drama" and a trophy for Awards. The chosen one is grey with a dark edge and a bold label.
  - Each list keeps the challenges in order; done ones stay in place, tinted green.
  - Each row shows a green points pill, filled once earned.
  - Tapping a row opens its sheet.
- **G05, G06: a challenge's sheet.**
  - The title and its pill, the hint, the Bible verse, who must be in it, and the group's photos for it.
  - "Take a photo" and "Choose from your photos" are pinned at the bottom. "Take a photo" is solid green until the challenge counts, then soft green, still apart from the outlined button under it.
  - A photo from the camera shows full screen before it goes (G05c). Photos chosen from the phone go straight in: they were looked at in the picker, and several can be chosen at once.
  - It says why when the phone can't send: uploads closed, phone blocked, or group full.
  - A rejected photo shows "Doesn't count: reason".
- **G05c: the photo just taken** (from a challenge's camera; a race's photo goes straight to its sheet, G09–G10).
  - Full screen, laid out like the photo view: an X top left and "Edit" with a sliders icon (as Google Photos has; 20 px, so it looks no bigger than the X) opposite, the photo, then what it's for with its pill ("Hornbill +50"), "Send" (focused) and, under it, "Retake".
  - The photo sits whole on a light grey canvas that fills the room between the top row and the title, edge to edge, so it's clear what's photo and what isn't. The photo is 32 px in from the sides and 16 px from the top and bottom, with square corners. The X, Edit, title and buttons sit on the page's 16 px gutter.
  - "Retake" opens the camera at once; the photo stays until a new one comes back, so closing the camera without one changes nothing.
  - The X asks "Discard this photo?" with "Keep" and "Discard" (G05e). Back asks the same. There's no Cancel or Delete button.
  - The photo is kept on the phone, not uploaded, until Send, so switching apps or the tab closing can't lose it: the strip then offers "Finish Hornbill photo", which opens it again. While it waits, every camera but the bottom bar's opens it instead. What's sent is the photo as cropped.
- **G05d: editing** ("Edit" on G05c, G09–G10's full-size photo and G12f). After Google Photos: "Cancel" top left, "Rotate" with its icon top right, the photo on G05c's grey canvas, faded into the canvas outside a frame. No title and no X: Cancel (and Back) leave without changing anything since editing opened.
  - Nothing shows under the photo until something changes. Then "Reset" (outlined, a third of the row but no wider than 123 px, its width on a 412 px phone) and "Done" (green, the rest). It's "Done", not "Save": the edit is only kept for the photo not sent yet. Their room is kept while they're hidden, so the photo doesn't jump when they appear, and a look that changes nothing ends on Cancel.
  - Rotate turns the photo a quarter turn clockwise each tap, and the frame turns with it, so a crop isn't lost. "Reset" puts back the whole photo, upright, and the buttons go again.
  - The frame starts round the whole photo. Its line and handles are white with a dark edge, so they show on any photo and on the canvas.
  - The photo sits 32 px in from the sides, as on G05c; the buttons stay on the 16 px gutter. No handle takes a touch in the photo's side gutters: a drag in from the screen's edge is the phone's Back. The top row only takes touches on Cancel and Rotate, so the top handles still work under it on a short screen.
  - Corners and edges drag to any shape, with 44 px handles; a drag inside moves it; thirds show while dragging. It's never smaller than 88 px a side, and the mid-edge handles go while a side is too short for three.
  - Cropping again starts from the last frame and turn, on the photo as taken.
- **G05e: "Discard this photo?"** The question, "Keep" and "Discard" (red), over the photo. Only for a photo from the camera: one chosen from the phone is still there, so its X discards it at once.
- **G05b: a race's sheet** (Any animal or Any flower on Spot it, or a race's photo still waiting for its name).
  - The title ("Animals spotted", "Flower colours"), then the race's rule ("Every different animal counts once. Name each one.") until a photo is taken or chosen.
  - What the group has found, each named under its photo. For animals, that includes every Spot it animal that counts (a swan sent for Swan), so every photo behind the row's "4 found" is there; the same animal can show twice, and counts once.
  - "Take a photo" (solid green: a race is never done) and "Choose from your photos". Either way the photo comes straight back to the sheet to be named (G09–G10): naming it is the look before it goes.
  - It says why when the phone can't send.
- **G07: Drama.** Optional challenges worth 80 each.
- **G08: Awards tab.** Its tab is a trophy. A race the group holds has a pastel gold row, as on the scoreboard (Spot it's Any animal and Any flower stay plain: the race is still open there).
  - One list: each race with its name, then its prize (gold outline while on offer, solid while the group holds it) and the standing ("Leading" or "Joint lead" in gold, or "3 behind"), and its count on the right.
  - Most animals spotted and Most flower colours end in a camera button that opens the camera straight away (then naming in the race's sheet); Most photos ends in a chevron to its photos. Every row keeps that end, so the counts line up: while the phone can't send, the camera is grey and a tap says why ("Uploads are closed"); with nothing to open, the chevron is faint and a tap says "No photos yet".
- **G09–G10: naming a race photo.**
  - The photo waits in the sheet, whole and at its own shape, 112 px tall, so a crop shows there too; its X discards it, asking first if it came from the camera (G05e). There's no "Next" and no "Retake": a photo that's not wanted is discarded with its X.
  - Tapping the thumbnail opens it full screen (G05c's layout, the canvas running to the bottom with no buttons): "Edit" crops and turns it (G05d), and the X or Back comes back to the sheet with the name kept.
  - **Animal:** "Which animal?" with suggestion chips. A Spot it animal the group hasn't earned goes there for its points ("Send for Hornbill +50"); it still counts for Animals spotted. "Already counted" makes the button "Send anyway".
  - **Flower:** nine colour tiles; ticks on colours the group already has.
  - **G09c:** an unfinished photo is kept on the phone, and the strip offers "Finish animal photo".
- **Bottom bar:**
  - "Take a photo" opens the camera. The icon beside it uploads from the phone: one photo goes through the same check, several go straight in as just a photo.
  - "Gallery".
- **G12f: checking a photo before it goes.**
  - "New photo" with "Edit" (G05d) by the title, the photo, a field reading "Just a photo, no challenge" that opens the challenge list, then "Add to gallery".
  - This sheet is where a camera photo from the bottom bar is first looked at, so there's no G05c before it, and it works the same way: "Retake" under "Add to gallery" (it opens the camera at once; the new photo takes the old one's place and keeps its challenge, not its crop), and the X asks "Discard this photo?" (G05e), as Back does. A photo from the phone has no "Retake", and its X discards it without asking.
  - On a short screen the photo shrinks, so the field always shows whole.
  - The list opens at the top: "Just a photo", then Animals spotted and Flower colours (any animal or flower goes there; each ends in a chevron, since naming comes next), then Spot it, with search ("kingfisher" finds Animals spotted: Kingfisher). Earned challenges show a filled pill and sit last. An animal or flower is named in the list's second step.
  - Swiping the sheet down keeps the photo on the phone, cropped or not: it shows in place of the camera, the strip offers "Finish photo", and either opens the sheet again.
  - A group whose photos don't count skips this sheet: a camera photo shows full screen (G05c, "Just a photo"), then goes in as just a photo.
- **G11:** after the first photo, "Add your name for photo credits"; it can be skipped.
- **G12–G14: upload strip.** One row per state, the one needing action first:
  - "Sending photo", or "Sending 4 of 25";
  - "Swan photo sent" or "Added to gallery", with the photo ticked; for one photo the line opens it full size. It goes after a few seconds, or when swiped sideways;
  - "No signal · 1 waiting";
  - "1 photo isn't sending · saved", with Retry;
  - "Couldn't open that photo", with "Pick another" and "Discard";
  - refusals ("Already sent…", "Already sent by another group"), which go by themselves after a few seconds;
  - "Use for Swan" / "Not now" when a just-a-photo is picked again for a challenge;
  - a blocked phone gets a banner with its code (G14c, G14e).
  - Photos keep sending from any page and survive a closed tab.
- **G15, G16:** the last round's card ends "Next 11:45 am · Back to Trellis Garden"; after the rounds it reads "Roundup · 11:45 am", "Back to Trellis Garden gazebo" with its pin, and "Finish your puzzle card, then lunch."
- **G17:** "This group link doesn't work"; a signal problem says "Couldn't load your group" with Retry.
- **G18:** with uploads closed, an amber banner, and no camera or upload buttons; Any animal and Any flower show a lock, and Awards' cameras are grey. The lists still show.

## Station ICs

- **S01:** sign in with the committee passphrase.
- **S02: committee home.**
  - An amber row while this phone owes a score ("1 score not saved").
  - Judge photos ("56 to check"), Hidden photos ("4 photos", or "None"; J14), Scores ("The Mind G2 overdue"), Controls ("Round 3 · ends 10:45 am"), Groups and Animal names.
  - Briefing comes before the stations before 9:45, at the bottom after.
  - **Stations:** each says "Due: Group 3 (Carl)" in amber, or who's playing now.
  - A failed refresh keeps the page, with Retry.
- **S03–S05: entering scores.**
  - One list of groups in visiting order, each with when it's here under its name: "10:05–10:25 am". With five groups, the gap in the times is the station's free round.
  - Groups whose round has ended are open, amber, marked "Score due".
  - While scores are due, the playing group folds to "Now".
  - A number box (the old score selected), Missed and Save; Save jumps to the next due box.
  - "Saved" with a tick. "Not saved" if left unsaved. "Type a number, or tap Missed."
- **S03b:** the page opens on the oldest score due (or `?group=g3`).
- **S07: no signal.** "Waiting" in Save's place. The score is kept and resent by itself; the top bar says "1 waiting".
- **S06: two people editing.** The row turns amber with "Keep 5" or "Save my 4".

## Judging

- **J01: the queue.**
  - One photo at a time, oldest first.
  - At the top: the group filter and "One | Grid".
  - Then what it's for, with a pencil (change challenge) and ⋯.
  - "G1 · 9:47 am · Alex", who must be in it, and the hint when it adds something.
  - The photo whole and rounded; tap to enlarge.
  - "Doesn't count" and "Counts" fixed at the bottom; "Looks fine" for a just-a-photo.
- **J01c:** a race entry starts its credit with the race. An animal that's also a Spot it challenge gets "Move to Hornbill +50".
- **J02:** reasons list, plus "Other reason".
- **J03:** the pencil opens the challenge list. For a race entry: "Rename to …" / "Edit name". A move counts the photo.
- **J04:** after a decision, the next photo shows at once. The bar says "Counts: G1 · Hornbill" with Undo for 8 s.
- **J05:** "G5 checked", or "All caught up" with a link to Animal names.
- **J08–J10: ⋯ menu.**
  - "Hide" (a duplicate, a blurry one, one not for the album): out of the gallery with its files kept. Undo here, or in the gallery's photo view ("Photo hidden" · Undo), and Unhide in Hidden photos (J14).
  - "Delete as inappropriate", which asks first and can block the phone.
  - "Delete", which asks "Delete this photo for good?" first.
- **J11:** the enlarged photo, with the same buttons.
- **J12, J13: Grid.**
  - Two columns of unchecked photos, grouped by challenge: Animals spotted and Flower colours first, each in its own section even with one photo; other challenges with one photo share an untitled section after a line, each tile captioned.
  - Tap one to judge it.
  - "Mark 23 checked" marks only the photos actually seen; it can be undone.
- **J14: Hidden photos** (`/c/hidden`, from the committee's home). Photos out of the gallery with their files kept, from Hide in the gallery's Select (E03g) or the ⋯ menu (J08), the latest hidden first (then those hidden before 15 Nov, newest first), three across, each captioned "G3 · Squirrel", with no hearts. Like an iPhone's Hidden album: nothing empties it by itself. It's a page of its own, not a filter in the gallery, so nobody picking photos in the gallery can tick a hidden one. "Nothing hidden." when empty; "No signal · showing earlier photos" when a look doesn't get through. It looks again every 30 s, but not while photos are being ticked, so nothing moves under a finger, and again when a photo view closes.
  - "Select", or holding a photo, ticks them as in the gallery; the title reads "2 selected" with "Select all" and "Cancel", and the back arrow gives way to Cancel. Android's Back ends picking; on iPhone, Cancel does (a swipe back leaves the page, ticks and all). The bar reads "Unhide" (outlined, a third of the row, no wider than on a 412 px phone) and "Delete for good" (outlined in red, as weighty as Unhide, since it asks first). Unhide puts them back in the gallery: "2 photos back in the gallery", with Undo for 8 s, which hides them again. One with a copy of the same file in the gallery now stays, still ticked: "1 still hidden: a copy is in the gallery". Delete for good asks "Delete 2 photos for good? It can't be undone." with "Keep them" and "Delete", then "2 photos deleted for good".
  - Another committee member got there first: "1 was deleted for good", "Already back in the gallery", "Already deleted for good". Ticks on photos that left that way go at the next look.
  - A Delete for good that didn't finish ("Couldn't finish…"), from the bar or the photo view, keeps its photos here, first in the list (ticked, from the bar), until one goes through, even though the server no longer lists them. While one runs, from the bar or the photo view, a look can't drop them either.
  - A session that ended goes to sign-in, then back here.
  - A photo opened here has no heart and no judge's actions: "Unhide" and "Delete for good" sit under it (E04h); Delete for good asks "Delete this photo for good?" first.
- **J06, J07: Animal names.**
  - Names as groups typed them. A likely misspelling gets "Merge into Hornbill", which can be undone.
  - Tapping a name opens a rename sheet.

## Committee lead

- **S02b: Briefing checklist.** Ticks are shared across phones. "First photos" ticks itself (4/6). A refresh that can't get through keeps the list, with "No signal · may be out of date" and Retry.
- **L00:** "Scores couldn't load" with Try again. A failed refresh keeps the page.
- **L01, L02: Scores tab.**
  - Station × group grid: "–" for no score, "×" for missed, amber for overdue.
  - Tapping a cell opens a score sheet (L01b).
  - Then standings and "Download CSV".
  - "Public scores locked at …" while locked.
- **L03: Round times.**
  - "Round 3 · ends 10:45 am".
  - ±5 min stepper with "Now: …" and "After: …" before "Move rounds" (L03h).
  - "Start round N now" (L03e) and "Reset to planned times" (L03g) both ask first.
- **L03b, L04, L05: switches.**
  - **Uploads:** closing asks first.
  - **Public scores:** "Lock scores" acts at once; "Unlock scores" asks first (L04b).
  - **Types of Christ:** "Hidden" (the default, in `data/guide.ts`) or "Shown in Help". "Show" asks first ("Show the Types of Christ?", L05b), since everyone can then read the answers; "Hide" acts at once.
  - **Photo times:** how a photo's time reads in the photo view, the judge's page and saved file names: "10:42 am" (the default for a one-morning event, in `data/event.ts`), "Sat 10:42 am" or "14 Nov, 10:42 am". The field names the chosen one ("Time only"); the sheet lists all three, each as the time now would read.
- **L03c:** blocked phones by code, with Unblock.
- **L06, L06b: Groups.** Each group with its IC and a pencil, and a copy-link icon. Tap to set the IC.

## Everyone

- **E00, E01, E02: Scoreboard.**
  - "● Live", or "Scores locked at 11:45 am".
  - If a refresh fails: "No signal · showing earlier scores".
  - Groups with place, total and photo points. Your group has a green border and a "You" tab.
  - **Breakdown** (tap a group): every station with its place and points ("–" if not played yet), then "Photo points" with its total, and under it "Challenges · 7 found" (a small square arrow: it opens the photos), then each award it holds as its own soft gold tile: a trophy on the left, the race and its count, and its prize. Points and prizes sit flush right. Races it doesn't hold aren't listed there.
- **E02b, E02c, E02e: Award races.**
  - Each race with the leader and count ("Group 1 · 5 animals"), and where your group stands: "You're 2 behind". No second place. Its prize sits on the right, level with the chevron, and ends where the group cards' totals do. With no leader yet ("No one yet") the chevron stays, faint.
  - A race your group leads is a gold row with the prize solid, a trophy left of its name, and "You're leading · 3 colours". In a tie, the leaders ("Groups 1, 3 and 5"), the count ("5 photos each"), then "You're tied for the lead".
  - Tap for the leader's photos. A tie opens a sheet of the joint leaders ("each gets +100"), your group tagged "You".
- **E03: Gallery.**
  - Two dropdowns, Group and Challenge (E03f).
  - **My photos** (in the Group list): the photos this phone sent, three across, newest first, with Newest / Most liked; the Challenge filter narrows it. Nothing on a tile says it's yours. Your photo opens with "Change challenge" and a bin (E04d, E04e). "No photos here yet." once they've all been removed. In demo mode, a visitor's photos show here and in Everyone, on their phone only.
  - Every photo, three across, more as you scroll. Two tabs under the filters: Newest (first) and Most liked. On Most liked the order stays put while you look; likes update in place.
  - Hearts to like. New photos wait behind an "N new photos" pill.
  - A check that can't get through keeps the photos, with "No signal · showing earlier photos" and a retry icon under the tabs.
  - **Saving photos** ([saving-photos.md](saving-photos.md)): "Select", or holding a photo, turns taps into ticks; while picking, the header reads "5 selected" with "Select all" (every photo under the filters; then "Deselect all") and "Cancel", and each photo's expand icon opens it, with "Select" / "Selected" in the full-size view. Ticks carry across filters.
    - iPhone: "Save 30 of 64" opens the share sheet for 30 at a time; saved ones untick. "Ready · Save …" if the wait used up the tap.
    - Android and computers: "Allow downloads if asked.", one tap downloads them all, then "Downloads started…" and "Done".
    - Over 30 ticked: "We'll share an album of every photo after the event." Failures: "1 photo didn't download…", "1 photo is no longer in the gallery."
    - Back closes an open photo first, then leaves picking. During a save, Back or leaving asks "Stop saving?" with "Keep saving" and "Stop".
  - **E03g: the committee's Hide.** Signed in, the bar reads "Hide" (outlined, a third of the row, no wider than on a 412 px phone) beside "Save 3 photos" once something is ticked and no save is running. Hide moves the ticked photos out of the gallery into Hidden photos (J14) with their files: "3 photos hidden", with Undo for 8 s, which puts back only what that Hide moved, where it was. Over 10 ticked (a Select all, say), it asks first: "Hide 120 photos? You can unhide them in Hidden photos." with "Cancel" and "Hide". Picking ends. While it runs, the ticks hold still. Opening a photo or a filter clears the toast, which would cover them.
    - Some didn't go on a weak signal: "50 of 51 hidden. Check your signal, then try again.", with Undo for those 50; the rest stay ticked. No answer at all: "Couldn't finish. Check your signal, then try again." (it may have gone through). All already hidden: "Already hidden". An Undo tapped while another action runs waits its turn; one that fails says "2 of 3 back. The rest are still hidden." While the bar is up, toasts sit above it, and a running action's spinner takes its button's label.
    - A hidden photo stops counting for its group. After the event the scoreboard is frozen, so the final totals don't change.
- **E03b, E03d, E03e:** one group's photos laid out by challenge, three across: Animals spotted and Flower colours first, then Stations, Spot it, Group shots and Drama; every photo its own tile, captioned with its challenge in up to three lines, so two for one challenge sit side by side. "Doesn't count" under rejected ones. "Photos not tagged to any challenge" comes last. No Newest / Most liked here: newest first within each challenge. "3 new photos" goes to the first section with one.
- **E03f:** the two lists. Group: Everyone, then My photos once this phone has a photo in the gallery (and while it's the filter, so the field can name it), then each group ("Group 3" in the field). Challenge, with search: All challenges, Photos not tagged to any challenge ("Not tagged" in the field), Photos the committee didn't count, then Animals spotted and Flower colours, then each kind.
  - "Photos the committee didn't count" ("Not counted" in the field; listed once a judge has turned one down) shows only the photos a judge said don't count, newest first with no sort tabs, three across, each captioned "Group 3 · Squirrel" (the challenge alone once a group is picked) with the reason in red under it, in up to two lines. "None so far." when there are none. It's for everyone, reasons included, so judges write reasons the whole outing can read. For the committee, the photo view's verdict control puts one right; it then leaves the list.
- **E04: photo view.**
  - Full screen on white. Swipe for the next photo, down or Back to close, pinch to zoom, double-tap to like.
  - Your own photo: "Change challenge" and a bin, which asks first (E04d, E04e).
  - Errors show over the photo with Retry.
  - A link to one photo shows "The photo couldn't load" or "This photo isn't in the gallery" when it fails.
- **E04b, E04f, E04g: committee in the photo view.**
  - The verdict as one control.
  - "Looks fine" for a just-a-photo.
  - "Doesn't count: reason" after a rejection.
- **E04h: a photo from Hidden photos (J14).** Its title and credit, then "Unhide" and "Delete for good", the same widths as in the bar. "Back in the gallery" or "Deleted for good" over the next photo; "A copy of this photo is in the gallery already" if it can't come back. One another committee member unhid or deleted meanwhile leaves the list, saying "Already back in the gallery" or "Already deleted for good".
