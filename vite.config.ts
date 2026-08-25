import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/transposition-grid/',
  plugins: [react()],
});
