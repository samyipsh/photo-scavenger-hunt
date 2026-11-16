// Station scores that didn't get through keep trying from any page, and ones a closed tab left
// behind start again as soon as the app opens (composables/useScoreQueue.ts).
export default defineNuxtPlugin(() => {
  startScoreQueue()
})
