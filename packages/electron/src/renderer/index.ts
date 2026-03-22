import '@mdview/core/styles/content.css';
import './workspace.css';
import { DOMPurifierUtil, ThemeEngine } from '@mdview/core';
import { MDViewElectronViewer } from './viewer';

// Configure DOMPurify to allow local-asset:// protocol for serving local file images/links.
// This must run before any rendering so DOMPurify preserves local-asset: URLs that are
// rewritten from relative paths during content preprocessing.
DOMPurifierUtil.configure({
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|local-asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
});

// Apply theme immediately — before viewer construction — so all workspace
// chrome (sidebar, tab bar, empty state) renders with the correct theme
// from the very first paint.  The main process already sets BrowserWindow
// backgroundColor to the stored theme's background, but CSS variables on
// :root are needed for the full UI.
async function applyInitialTheme(): Promise<void> {
  try {
    const state = await window.mdview.getState();
    const themeName = state.preferences.theme || 'github-light';
    const themeEngine = new ThemeEngine();
    await themeEngine.applyTheme(themeName);
  } catch {
    // Best-effort — workspace CSS vars fall back to defaults
  }
}

void applyInitialTheme().then(() => {
  const viewer = new MDViewElectronViewer();
  void viewer.initialize();
});
