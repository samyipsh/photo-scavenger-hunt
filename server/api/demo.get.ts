// Whether this is the public demo. The demo's committee passphrase is public on purpose, so
// anyone can try the committee's pages: the nightly reset undoes what they do.
export default defineEventHandler((event) => {
  if (!isDemo(event)) return { demo: false as const }
  return { demo: true as const, passphrase: useRuntimeConfig(event).committeePassphrase }
})
