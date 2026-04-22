import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitPanel } from './git-panel';
import type { GitFileStatus } from '@mdreview/core';

describe('GitPanel', () => {
  let panel: GitPanel;
  let container: HTMLElement;

  const mockFiles: GitFileStatus[] = [
    { path: 'src/index.ts', status: 'modified', staged: true },
    { path: 'src/utils.ts', status: 'added', staged: false },
    { path: 'old-file.ts', status: 'deleted', staged: false },
    { path: 'readme.md', status: 'untracked', staged: false },
    { path: 'config.ts', status: 'renamed', staged: true },
  ];

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container')!;
    panel = new GitPanel();
    panel.render(container);
  });

  afterEach(() => {
    panel.dispose();
    document.body.innerHTML = '';
  });

  it('renders git panel into container', () => {
    const el = container.querySelector('.git-panel');
    expect(el).not.toBeNull();
  });

  it('is hidden when isGitRepo is false', () => {
    panel.update(false, '', []);
    const el = container.querySelector('.git-panel') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('shows changed files with status icons', () => {
    panel.update(true, 'main', mockFiles);
    const files = container.querySelectorAll('.git-panel-file');
    expect(files).toHaveLength(5);

    // Check first file has 'M' status
    const firstStatus = files[0].querySelector('.git-panel-status');
    expect(firstStatus?.textContent).toBe('M');
    expect(firstStatus?.classList.contains('git-status-modified')).toBe(true);

    // Check second file has 'A' status
    const secondStatus = files[1].querySelector('.git-panel-status');
    expect(secondStatus?.textContent).toBe('A');
    expect(secondStatus?.classList.contains('git-status-added')).toBe(true);

    // Check deleted file has 'D' status
    const thirdStatus = files[2].querySelector('.git-panel-status');
    expect(thirdStatus?.textContent).toBe('D');
    expect(thirdStatus?.classList.contains('git-status-deleted')).toBe(true);

    // Check untracked file has '?' status
    const fourthStatus = files[3].querySelector('.git-panel-status');
    expect(fourthStatus?.textContent).toBe('?');
    expect(fourthStatus?.classList.contains('git-status-untracked')).toBe(true);

    // Check renamed file has 'R' status
    const fifthStatus = files[4].querySelector('.git-panel-status');
    expect(fifthStatus?.textContent).toBe('R');
    expect(fifthStatus?.classList.contains('git-status-renamed')).toBe(true);
  });

  it('checkbox reflects staged state', () => {
    panel.update(true, 'main', mockFiles);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('.git-panel-file-checkbox');

    expect(checkboxes[0].checked).toBe(true); // src/index.ts is staged
    expect(checkboxes[1].checked).toBe(false); // src/utils.ts is not staged
  });

  it('checkbox toggle fires stage callback when checked', () => {
    const stageCallback = vi.fn();
    panel.onStage(stageCallback);
    panel.update(true, 'main', mockFiles);

    const checkboxes = container.querySelectorAll<HTMLInputElement>('.git-panel-file-checkbox');
    // Check the unstaged file
    checkboxes[1].checked = true;
    checkboxes[1].dispatchEvent(new Event('change'));

    expect(stageCallback).toHaveBeenCalledWith(['src/utils.ts']);
  });

  it('checkbox toggle fires unstage callback when unchecked', () => {
    const unstageCallback = vi.fn();
    panel.onUnstage(unstageCallback);
    panel.update(true, 'main', mockFiles);

    const checkboxes = container.querySelectorAll<HTMLInputElement>('.git-panel-file-checkbox');
    // Uncheck the staged file
    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event('change'));

    expect(unstageCallback).toHaveBeenCalledWith(['src/index.ts']);
  });

  it('Stage All button fires stage callback with all unstaged paths', () => {
    const stageCallback = vi.fn();
    panel.onStage(stageCallback);
    panel.update(true, 'main', mockFiles);

    const stageAllBtn = container.querySelector('.git-panel-bulk-btn') as HTMLElement;
    expect(stageAllBtn.textContent).toBe('Stage All');
    stageAllBtn.click();

    expect(stageCallback).toHaveBeenCalledWith(['src/utils.ts', 'old-file.ts', 'readme.md']);
  });

  it('Unstage All button fires unstage callback with all staged paths', () => {
    const unstageCallback = vi.fn();
    panel.onUnstage(unstageCallback);
    panel.update(true, 'main', mockFiles);

    const btns = container.querySelectorAll('.git-panel-bulk-btn');
    const unstageAllBtn = btns[1] as HTMLElement;
    expect(unstageAllBtn.textContent).toBe('Unstage All');
    unstageAllBtn.click();

    expect(unstageCallback).toHaveBeenCalledWith(['src/index.ts', 'config.ts']);
  });

  it('commit button disabled when no files are staged', () => {
    const noStagedFiles: GitFileStatus[] = [
      { path: 'src/index.ts', status: 'modified', staged: false },
    ];
    panel.update(true, 'main', noStagedFiles);

    const commitInput = container.querySelector('.git-panel-commit-input') as HTMLInputElement;
    commitInput.value = 'test commit';
    commitInput.dispatchEvent(new Event('input'));

    const commitBtn = container.querySelector('.git-panel-commit-btn') as HTMLButtonElement;
    expect(commitBtn.disabled).toBe(true);
  });

  it('commit button disabled when message is empty', () => {
    panel.update(true, 'main', mockFiles);

    const commitBtn = container.querySelector('.git-panel-commit-btn') as HTMLButtonElement;
    expect(commitBtn.disabled).toBe(true);
  });

  it('commit button enabled when files staged and message provided', () => {
    panel.update(true, 'main', mockFiles);

    const commitInput = container.querySelector('.git-panel-commit-input') as HTMLInputElement;
    commitInput.value = 'test commit message';
    commitInput.dispatchEvent(new Event('input'));

    const commitBtn = container.querySelector('.git-panel-commit-btn') as HTMLButtonElement;
    expect(commitBtn.disabled).toBe(false);
  });

  it('fires commit callback with message text', () => {
    const commitCallback = vi.fn();
    panel.onCommit(commitCallback);
    panel.update(true, 'main', mockFiles);

    const commitInput = container.querySelector('.git-panel-commit-input') as HTMLInputElement;
    commitInput.value = 'fix: resolve issue';
    commitInput.dispatchEvent(new Event('input'));

    const commitBtn = container.querySelector('.git-panel-commit-btn') as HTMLButtonElement;
    commitBtn.click();

    expect(commitCallback).toHaveBeenCalledWith('fix: resolve issue');
  });

  it('clears commit input after commit', () => {
    const commitCallback = vi.fn();
    panel.onCommit(commitCallback);
    panel.update(true, 'main', mockFiles);

    const commitInput = container.querySelector('.git-panel-commit-input') as HTMLInputElement;
    commitInput.value = 'fix: resolve issue';
    commitInput.dispatchEvent(new Event('input'));

    const commitBtn = container.querySelector('.git-panel-commit-btn') as HTMLButtonElement;
    commitBtn.click();

    expect(commitInput.value).toBe('');
  });

  it('panel collapses and expands on header click', () => {
    panel.update(true, 'main', mockFiles);

    const header = container.querySelector('.git-panel-header') as HTMLElement;
    expect(container.querySelector('.git-panel-files')).not.toBeNull();

    // Collapse
    header.click();
    expect(container.querySelector('.git-panel-files')).toBeNull();

    // Expand
    header.click();
    expect(container.querySelector('.git-panel-files')).not.toBeNull();
  });

  it('shows branch name badge in header', () => {
    panel.update(true, 'feature-branch', mockFiles);

    const badge = container.querySelector('.git-panel-branch-badge');
    expect(badge?.textContent).toBe('feature-branch');
  });

  it('shows staged file count', () => {
    panel.update(true, 'main', mockFiles);

    const stagedCount = container.querySelector('.git-panel-staged-count');
    expect(stagedCount?.textContent).toBe('2 files staged');
  });

  it('shows singular when 1 file staged', () => {
    const singleStaged: GitFileStatus[] = [
      { path: 'src/index.ts', status: 'modified', staged: true },
    ];
    panel.update(true, 'main', singleStaged);

    const stagedCount = container.querySelector('.git-panel-staged-count');
    expect(stagedCount?.textContent).toBe('1 file staged');
  });

  it('shows file path text', () => {
    panel.update(true, 'main', mockFiles);
    const paths = container.querySelectorAll('.git-panel-file-path');
    expect(paths[0].textContent).toBe('src/index.ts');
  });
});
