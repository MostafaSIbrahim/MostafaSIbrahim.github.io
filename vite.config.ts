import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // user site: served from the domain root
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // The public site, the content admin at /admin/, and the 404 page
      input: { main: 'index.html', admin: 'admin/index.html', notFound: '404.html' },
    },
  },
});
