// After `nuxt build`, writes the staging deploy config next to the one Nitro generated: the same
// build, with the staging name, database, bucket and vars from wrangler.staging.jsonc. Deploying with
// -c this file leaves Nitro's redirect, and so every production command, pointing at production.
// Only name, d1_databases, r2_buckets and vars come from wrangler.staging.jsonc; everything else
// (compatibility date and flags, assets, observability, placement) comes from wrangler.jsonc, so change those there.
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const built = JSON.parse(readFileSync(new URL('.output/server/wrangler.json', root), 'utf8'))
const staging = JSON.parse(readFileSync(new URL('wrangler.staging.jsonc', root), 'utf8').replace(/^\s*\/\/.*$/gm, ''))

const config = { ...built, name: staging.name, d1_databases: staging.d1_databases, r2_buckets: staging.r2_buckets, vars: staging.vars }
writeFileSync(new URL('.output/server/wrangler.staging.json', root), `${JSON.stringify(config, null, 2)}\n`)
console.log(`Staging config written for ${config.name}`)
