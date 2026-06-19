import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PhaserForge User Guide',
  description: 'Step-by-step guidance for building and publishing PhaserForge demos.',
  base: '/phaserforge/docs/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started/cloud-account-setup' },
      { text: 'Reference', link: '/reference/editor-workflows' },
      { text: 'Troubleshooting', link: '/troubleshooting/github-pages-publish' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Cloud Account Setup', link: '/getting-started/cloud-account-setup' },
          { text: 'Pattern Demo', link: '/getting-started/pattern-demo' },
          { text: 'Publish to GitHub Pages', link: '/getting-started/publish-to-github-pages' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Editor Workflows', link: '/reference/editor-workflows' },
          { text: 'Workflow Glossary', link: '/reference/workflow-glossary' },
        ],
      },
      {
        text: 'Troubleshooting',
        items: [{ text: 'GitHub Pages Publish', link: '/troubleshooting/github-pages-publish' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/bcorfman/phaserforge' }],
  },
});
