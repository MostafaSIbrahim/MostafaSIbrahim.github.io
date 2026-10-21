import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // user site: served from the domain root
  build: { target: 'es2022', sourcemap: true },
});
