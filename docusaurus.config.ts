import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Oposiciones TIC',
  tagline: 'Tests con explicación de cada opción y su fuente',
  favicon: 'img/logo.svg',

  future: {
    v4: true,
  },

  url: 'https://cfernande1408.github.io',
  baseUrl: '/oposiciones-tic/',
  organizationName: 'cfernande1408',
  projectName: 'oposiciones-tic',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  headTags: [
    {tagName: 'link', attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'}},
    {tagName: 'link', attributes: {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous'}},
  ],
  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap',
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: 'apuntes',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Oposiciones TIC',
      logo: {
        alt: '',
        src: 'img/logo.svg',
      },
      items: [
        {to: '/', label: 'Test', position: 'left', activeBaseRegex: '^/oposiciones-tic/?$'},
        {type: 'docSidebar', sidebarId: 'apuntes', position: 'left', label: 'Apuntes'},
        {
          href: 'https://github.com/cfernande1408/oposiciones-tic',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      copyright:
        'Respuestas no oficiales salvo las confirmadas por el tribunal. Comprueba siempre la norma en el BOE consolidado.',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
