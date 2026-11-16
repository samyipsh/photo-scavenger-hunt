import tailwindcss from '@tailwindcss/vite'
import { EVENT } from './data/event'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // A single-page app: the Worker only runs for /api and /img, and page loads
  // are served as static files, which don't count towards Cloudflare's limits.
  ssr: false,

  modules: ['shadcn-nuxt', 'nuxt-auth-utils'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  app: {
    head: {
      title: EVENT.appName,
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#ffffff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  runtimeConfig: {
    // Set NUXT_COMMITTEE_PASSPHRASE in .env locally and as a Worker secret in production.
    committeePassphrase: '',
    // A committee sign-in lasts a day, so a copied cookie stops working by the next morning.
    session: { maxAge: 60 * 60 * 24 },
  },

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
    prerender: {
      routes: ['/'],
    },
  },
})
