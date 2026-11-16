export const FLOWER_COLOURS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'pink', 'two-tone'] as const
// How each colour is drawn: on the colour tiles, and on the Awards tab's row of found colours.
export const FLOWER_SWATCH: Record<string, string> = {
  'red': '#dc2626', 'orange': '#f97316', 'yellow': '#facc15', 'green': '#16a34a', 'blue': '#2563eb',
  'purple': '#9333ea', 'white': '#ffffff', 'pink': '#ec4899', 'two-tone': 'linear-gradient(135deg,#ec4899 50%,#facc15 50%)',
}
