import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PhaserForge User Guide',
  description: 'Step-by-step guidance for building and publishing PhaserForge demos.',
  base: '/phaserforge/docs/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Reference', link: '/reference/editor-workflows' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/getting-started/' },
          { text: 'Pattern Demo', link: '/getting-started/pattern-demo' },
          { text: 'Publish to GitHub Pages', link: '/getting-started/publish-to-github-pages' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'Editor Workflows', link: '/reference/editor-workflows' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/bcorfman/phaserforge' }],
  },
});
