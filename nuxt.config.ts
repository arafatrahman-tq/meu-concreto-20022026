// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui"],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    // Override via NUXT_SESSION_SECRET env var — must be ≥32 chars in production
    sessionSecret:
      process.env.NUXT_SESSION_SECRET ||
      "meu-concreto-dev-only-secret-change-in-production!!",
  },

  build: {
    transpile: ["zod"],
  },

  routeRules: {
    "/": { prerender: true },
  },

  compatibilityDate: "2025-01-15",

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },
});
