import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // user site: served from the domain root
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Two pages: the public site and the content admin at /admin/
      input: { main: 'index.html', admin: 'admin/index.html' },
    },
  },
});
