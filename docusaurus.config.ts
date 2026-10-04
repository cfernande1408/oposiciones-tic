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
  trailingSlash: true,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  clientModules: ['./src/fuentes.ts'],

  plugins: [
    [
      '@docusaurus/plugin-pwa',
      {
        // Sin conexión en móvil, en la app instalada o con ?offlineMode=true
        offlineModeActivationStrategies: ['appInstalled', 'standalone', 'mobile', 'queryString'],
        pwaHead: [
          {tagName: 'link', rel: 'manifest', href: '/oposiciones-tic/manifest.json'},
          {tagName: 'meta', name: 'theme-color', content: '#b8325c'},
          {tagName: 'meta', name: 'apple-mobile-web-app-capable', content: 'yes'},
          {tagName: 'meta', name: 'apple-mobile-web-app-status-bar-style', content: 'default'},
          {tagName: 'meta', name: 'apple-mobile-web-app-title', content: 'Opos TIC'},
          {tagName: 'link', rel: 'apple-touch-icon', href: '/oposiciones-tic/img/pwa/apple-touch-icon.png'},
        ],
      },
    ],
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
