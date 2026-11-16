---
name: mobile-ux
description: Use when designing, building or reviewing screens of a phone web app, especially one people use once, outdoors or in a hurry.
---
# Mobile UX
Assume one hand, patchy signal, first use, in a hurry.
- **Touch:** text at least 16 px, tap targets at least 44 px, the main action in thumb reach. One gutter; check edges at 360 and 390 px. Never move content under a finger: new items wait behind "3 new".
- **Words:** cut any line that doesn't change what someone does next. Name actions for what they do ("Delete"). No privacy or policy notes in the UI.
- **Controls:** custom bottom sheets, not native pickers. On Android Chrome only `capture` opens the camera, so keep "Take a photo" and "Choose from your photos" separate. Back closes the open sheet first. Undo instead of confirm, except for what can't be undone.
- **Network:** queue uploads on the phone and retry with client-chosen IDs. When a refresh fails, keep what was shown and say "No signal". Lazy images on stable URLs.
- **States:** design and check open sheets, menus, dialogs, empty, loading (a skeleton, no "Loading" word), error and offline.
- **Events:** a game changes behaviour. Reward what you want more of (people in photos), and keep likes for after the event.
- **Checking:** a real phone on each platform first. Decide between designs side by side.
