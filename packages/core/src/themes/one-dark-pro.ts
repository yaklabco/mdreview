/**
 * One Dark Pro Theme
 * Inspired by Atom's One Dark color scheme
 */

import type { Theme } from '../types';

const oneDarkPro: Theme = {
  name: 'one-dark-pro',
  displayName: 'One Dark Pro',
  variant: 'dark',
  author: 'Atom / One Dark',
  version: '1.0.0',

  colors: {
    background: '#282c34',
    backgroundSecondary: '#21252b',
    backgroundTertiary: '#2c313a',
    foreground: '#abb2bf',
    foregroundSecondary: '#828997',
    foregroundMuted: '#5c6370',
    primary: '#61afef',
    secondary: '#98c379',
    accent: '#c678dd',
    heading: '#e5c07b',
    link: '#61afef',
    linkHover: '#528bff',
    linkVisited: '#c678dd',
    codeBackground: '#2c313a',
    codeText: '#abb2bf',
    codeKeyword: '#c678dd',
    codeString: '#98c379',
    codeComment: '#5c6370',
    codeFunction: '#61afef',
    border: '#3e4452',
    borderLight: '#4b5263',
    borderHeavy: '#5c6370',
    selection: 'rgba(97, 175, 239, 0.2)',
    highlight: '#e5c07b',
    shadow: 'rgba(0, 0, 0, 0.5)',
    success: '#98c379',
    warning: '#e5c07b',
    error: '#e06c75',
    info: '#61afef',
    commentHighlight: 'rgba(229, 192, 123, 0.25)',
    commentHighlightResolved: 'rgba(229, 192, 123, 0.08)',
    commentCardBg: '#2c313a',
  },

  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    codeFontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    baseFontSize: '16px',
    baseLineHeight: 1.5,
    h1Size: '2em',
    h2Size: '1.5em',
    h3Size: '1.25em',
    h4Size: '1em',
    h5Size: '0.875em',
    h6Size: '0.85em',
    fontWeightNormal: 400,
    fontWeightBold: 600,
    headingFontWeight: 600,
  },

  spacing: {
    blockMargin: '16px 0',
    paragraphMargin: '16px 0',
    listItemMargin: '4px 0',
    headingMargin: '24px 0 16px 0',
    codeBlockPadding: '16px',
    tableCellPadding: '6px 13px',
  },

  syntaxTheme: 'github-dark',

  mermaidTheme: {
    theme: 'dark',
    themeVariables: {
      primaryColor: '#61afef',
      primaryTextColor: '#282c34',
      primaryBorderColor: '#61afef',
      lineColor: '#abb2bf',
      secondaryColor: '#21252b',
      tertiaryColor: '#2c313a',
      background: '#282c34',
      mainBkg: '#21252b',
      secondaryBkg: '#2c313a',
      tertiaryBkg: '#282c34',
      textColor: '#abb2bf',
      tertiaryTextColor: '#abb2bf',
      nodeBkg: '#21252b',
      nodeBorder: '#3e4452',
      clusterBkg: '#2c313a',
      clusterBorder: '#3e4452',
      defaultLinkColor: '#61afef',
      titleColor: '#e5c07b',
      edgeLabelBackground: '#282c34',
      relationLabelColor: '#abb2bf',
      relationLabelBackground: '#282c34',
      attributeBackgroundColorOdd: '#21252b',
      attributeBackgroundColorEven: '#2c313a',
    },
  },
};

export default oneDarkPro;
