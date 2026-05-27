import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ferme-broka.fr',
  output: 'static',
  compressHTML: true,
  build: {
    assets: '_astro',
  },
});
