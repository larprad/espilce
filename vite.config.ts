import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any subpath (GitHub Pages serves
  // this app at /espilce/). Runtime-loaded assets (textures, fonts) must be
  // prefixed with import.meta.env.BASE_URL in code.
  base: './',
})
