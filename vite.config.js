import { defineConfig } from 'vite'

/*
 * The book was on Vite's default port, which made it one of four projects that
 * could not run beside each other. 5360 is its slot in the local port band now,
 * and strictPort means a taken port fails loudly instead of quietly moving
 * somewhere a verification pass is not looking.
 */
export default defineConfig({
  server: { port: 5360, strictPort: true },
})
