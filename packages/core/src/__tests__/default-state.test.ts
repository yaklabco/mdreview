import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFERENCES, DEFAULT_STATE } from '../default-state';
import type { AppState } from '../types/index';

describe('DEFAULT_PREFERENCES', () => {
  it('has all required Preferences fields', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('github-light');
    expect(DEFAULT_PREFERENCES.autoTheme).toBe(true);
    expect(DEFAULT_PREFERENCES.lightTheme).toBe('github-light');
    expect(DEFAULT_PREFERENCES.darkTheme).toBe('github-dark');
    expect(DEFAULT_PREFERENCES.syntaxTheme).toBe('github');
    expect(DEFAULT_PREFERENCES.autoReload).toBe(true);
    expect(DEFAULT_PREFERENCES.lineNumbers).toBe(false);
    expect(DEFAULT_PREFERENCES.enableHtml).toBe(false);
    expect(DEFAULT_PREFERENCES.syncTabs).toBe(false);
    expect(DEFAULT_PREFERENCES.logLevel).toBe('error');
    expect(DEFAULT_PREFERENCES.showToc).toBe(false);
    expect(DEFAULT_PREFERENCES.tocMaxDepth).toBe(6);
    expect(DEFAULT_PREFERENCES.tocAutoCollapse).toBe(false);
    expect(DEFAULT_PREFERENCES.tocPosition).toBe('left');
    expect(DEFAULT_PREFERENCES.tocStyle).toBe('floating');
    expect(DEFAULT_PREFERENCES.commentsEnabled).toBe(true);
    expect(DEFAULT_PREFERENCES.commentAuthor).toBe('');
    expect(DEFAULT_PREFERENCES.blockedSites).toEqual([]);
  });
});

describe('DEFAULT_STATE', () => {
  it('matches the AppState structure', () => {
    const state: AppState = DEFAULT_STATE;
    expect(state).toHaveProperty('preferences');
    expect(state).toHaveProperty('document');
    expect(state).toHaveProperty('ui');
  });

  it('has correct document defaults', () => {
    expect(DEFAULT_STATE.document.path).toBe('');
    expect(DEFAULT_STATE.document.content).toBe('');
    expect(DEFAULT_STATE.document.scrollPosition).toBe(0);
    expect(DEFAULT_STATE.document.renderState).toBe('pending');
  });

  it('has correct ui defaults', () => {
    expect(DEFAULT_STATE.ui.theme).toBeNull();
    expect(DEFAULT_STATE.ui.maximizedDiagram).toBeNull();
    expect(DEFAULT_STATE.ui.visibleDiagrams).toBeInstanceOf(Set);
    expect(DEFAULT_STATE.ui.visibleDiagrams.size).toBe(0);
    expect(DEFAULT_STATE.ui.tocVisible).toBe(false);
  });

  it('preferences in state match DEFAULT_PREFERENCES', () => {
    expect(DEFAULT_STATE.preferences).toEqual(DEFAULT_PREFERENCES);
  });
});
