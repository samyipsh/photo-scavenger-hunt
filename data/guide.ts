// The participant guide inside the app (/guide, from Help › Misc): the morning's timeline, how
// scoring works and the photo quest, in the committee's words from the guide sent on WhatsApp
// (the committee's Google Doc, Participant guide tab, is the source; change both). The station
// points chart between the scoring lines is drawn from GROUP_COUNT and RANK_SCALE in event.ts.
//
// Also the Types of Christ page's name and whether it starts hidden. Its answers are in
// types-of-christ.ts, which only the server reads.

export const GUIDE = {
  title: 'Participant guide',
  quest: 'Between stations, do the photo quest in the app.',
  // Times as printed. `map` is a Google Maps search: a place's name or "lat,lng". The `main` row,
  // the rounds, gets a filled dot.
  timeline: [
    { time: '8:30', what: 'Breakfast, provided', where: { name: 'Botanic Gardens MRT Exit A', map: 'Botanic Gardens MRT Station Exit A' } },
    { time: '8:50', what: 'Walk over. Toilets at the Bukit Timah Visitor Services Counter on the way' },
    { time: '9:00', what: 'Opening prayer and devotion', where: { name: 'Trellis Garden gazebo', map: '1.32121,103.81537' } },
    { time: '9:25', what: 'Briefing on the stations, puzzle card and photo quest' },
    { time: '9:35', what: 'Try sending a photo, then walk to your first station' },
    { time: '9:45', what: 'Station games and photo walk: six rounds of 20 minutes. Your group’s stops are in the app', where: { name: 'Around Eco-Lake', map: '1.32114,103.81747' }, main: true },
    { time: '11:45', what: 'Back together: finish your puzzle card, then results, prizes and the Types of Christ', where: { name: 'Trellis Garden gazebo', map: '1.32121,103.81537' } },
    { time: '12:30', what: 'Walk to lunch', where: { name: 'Adam Road Food Centre', map: 'Adam Road Food Centre' } },
  ] as { time: string, what: string, where?: { name: string, map: string }, main?: boolean }[],
  // Before the station points chart; it says the number of groups, so change it with GROUP_COUNT.
  scoringIntro: 'Each station ranks the five groups.',
  // After the chart (which ends with how a tie splits points).
  scoring: [
    'Each photo challenge you complete earns 10 to 80 points.',
    'The highest total wins and picks their bubble tea first. A tie goes to the group with more photo points.',
  ],
}

export const TYPES = {
  title: 'Types of Christ',
  // Hidden until the committee shows them at the results (Manage › Controls), so groups can't
  // look up the answers to the puzzle card.
  shownAtStart: false,
}
