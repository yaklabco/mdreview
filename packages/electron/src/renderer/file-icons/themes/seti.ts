import type { IconTheme } from '../types';

/**
 * Seti Icon Theme — classic file icons inspired by the Seti UI icon set.
 * Distinct warm colors per file type with simple filled silhouettes.
 */
export const setiTheme: IconTheme = {
  id: 'seti',
  displayName: 'Seti',
  folder:
    '<svg viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" fill="#C5C5C5"/></svg>',
  folderOpen:
    '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" fill="#a0a0a0"/><path d="M2 10h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8z" fill="#C5C5C5"/></svg>',
  markdown:
    '<svg viewBox="0 0 24 24"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill="#519ABA"/><path d="M14 2v4a2 2 0 0 0 2 2h4" fill="#3d7a94"/><path d="M8 13v5l2-2.5L12 18v-5" fill="#fff" stroke="#fff" stroke-width="0.5"/><path d="M14 14v4l1.5-2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  image:
    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#A074C4"/><circle cx="8.5" cy="8.5" r="2" fill="#fff" opacity="0.6"/><path d="M21 15l-5-5-8 8" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.7"/></svg>',
  code:
    '<svg viewBox="0 0 24 24"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill="#CBCB41"/><path d="M14 2v4a2 2 0 0 0 2 2h4" fill="#a6a632"/><path d="m9 13-2 2 2 2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 13-2 2 2 2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="scale(-1,1) translate(-24,0)"/></svg>',
  config:
    '<svg viewBox="0 0 24 24"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill="#E37933"/><path d="M14 2v4a2 2 0 0 0 2 2h4" fill="#c25e1e"/><circle cx="12" cy="14" r="2.5" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M12 9.5v2m0 5v2m-3.9-2.3 1.7-1m4.4-2.5 1.7-1m-7.8 0 1.7 1m4.4 2.5 1.7 1" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>',
  genericFile:
    '<svg viewBox="0 0 24 24"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill="#D4D7D6"/><path d="M14 2v4a2 2 0 0 0 2 2h4" fill="#b0b3b2"/></svg>',
};
