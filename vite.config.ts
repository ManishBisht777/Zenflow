import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VERCEL_PROJECT_PRODUCTION_URL (set by Vercel at build time) fills the absolute og:image URL in index.html
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_', 'VERCEL_PROJECT_PRODUCTION_URL'],
});
