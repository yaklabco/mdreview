import '@mdreview/core/styles/content.css';
import './workspace.css';
import { DOMPurifierUtil, ThemeEngine } from '@mdreview/core';
import { initLogging, type ResourceAttrs } from '@mdreview/core/logging';
import { IpcLogTransport } from './logging/ipc-log-transport';
import { MDReviewElectronViewer } from './viewer';

// Initialise renderer-side structured logging as early as possible so the
// rest of the bootstrap can emit through the buffered pipeline. The
// IpcLogTransport forwards batches to the main process; pre-init records are
// captured by the in-process ring and replayed once initLogging runs.
async function initRendererLogging(): Promise<void> {
  try {
    const info = await window.mdreview.getRuntimeInfo();
    const resource: ResourceAttrs = {
      'service.name': 'mdview',
      'service.version': info.version,
      'service.namespace': 'electron-renderer',
      'deployment.environment': info.isPackaged ? 'prod' : 'dev',
      'host.os': info.platform,
    };
    const transport = new IpcLogTransport((records) => window.mdreview.logBatch(records));
    initLogging({ transport, resource });
  } catch {
    // If the preload bridge is unavailable, pre-init log records remain in the
    // RingBuffer and a later initLogging call (if any) will drain them.
  }
}

void initRendererLogging();

// Configure DOMPurify to allow local-asset:// protocol for serving local file images/links.
// This must run before any rendering so DOMPurify preserves local-asset: URLs that are
// rewritten from relative paths during content preprocessing.
DOMPurifierUtil.configure({
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|local-asset|app):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
});

// Apply theme immediately — before viewer construction — so all workspace
// chrome (sidebar, tab bar, empty state) renders with the correct theme
// from the very first paint.  The main process already sets BrowserWindow
// backgroundColor to the stored theme's background, but CSS variables on
// :root are needed for the full UI.
async function applyInitialTheme(): Promise<void> {
  try {
    const state = await window.mdreview.getState();
    const themeName = state.preferences.theme || 'github-light';
    const themeEngine = new ThemeEngine();
    await themeEngine.applyTheme(themeName);
  } catch {
    // Best-effort — workspace CSS vars fall back to defaults
  }
}

void applyInitialTheme().then(() => {
  const viewer = new MDReviewElectronViewer();
  void viewer.initialize();
});
