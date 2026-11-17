---
name: mobile-ux
description: Use when designing, building or reviewing screens of a phone web app
---
# Mobile UX
- **App context**: 
  - Determine how it's being used and what the app is for: one hand? patchy signal? first use? in a hurry? gamified?  
- **Touch:** 
  - text at least 16 px, tap targets at least 44 px, the main action in thumb reach.
  - One gutter; check edges at 360 and 390 px. Never move content under a finger.
- **Words:** 
  - cut any line that doesn't change what someone does next. 
  - Name actions for what they do ("Delete"). 
  - No privacy or policy notes in the UI.
- **Controls:** 
  - custom bottom sheets, not native pickers.
  - Back closes the open sheet first. 
  - Weigh whether to use Undo or Confirm and rationalize to user
  - For photo upload, on Android Chrome only `capture` opens the camera, so keep "Take a photo" and "Choose from your photos" separate. 
- **Network:** 
  - Queue uploads on the phone and retry with client-chosen IDs.
  - When a refresh fails, keep what was shown and say "No signal". 
  - Lazy images on stable URLs.
- **States:** design and check open sheets, menus, dialogs, empty, loading (a skeleton, no "Loading" word), error and offline.
- **Checking:** a real phone on each platform first. Decide between designs side by side.
