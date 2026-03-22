import type { IconTheme } from '../types';

/**
 * Catppuccin Icon Theme — soft pastel outlined icons using the Catppuccin Mocha palette.
 * Teal, mauve, peach, green, and blue tones for a soothing file tree.
 */
export const catppuccinTheme: IconTheme = {
  id: 'catppuccin',
  displayName: 'Catppuccin',
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#89b4fa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/></svg>',
  folderOpen:
    '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" stroke="#89b4fa"/><path d="M3 10h15a1 1 0 0 1 1 1l-1.5 7H5.5L3 11V7" stroke="#89b4fa" fill="rgba(137,180,250,0.15)"/></svg>',
  markdown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#94e2d5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 9v6l2-2.5L13 15V9"/><path d="M15 12v3l1.5-2"/></svg>',
  image:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#a6e3a1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  code:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#cba6f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m10 10-2 2 2 2"/><path d="m14 10 2 2-2 2"/></svg>',
  config:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fab387" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-2.6-6.4-2.1 2.1m-8.6 8.6-2.1 2.1m0-12.8 2.1 2.1m8.6 8.6 2.1 2.1"/></svg>',
  genericFile:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#9399b2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6z"/><path d="M13 3v6h6"/></svg>',
};
