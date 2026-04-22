import type { GitFileStatus } from '@mdreview/core';

const STATUS_LABELS: Record<GitFileStatus['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  untracked: '?',
  renamed: 'R',
};

const STATUS_CLASSES: Record<GitFileStatus['status'], string> = {
  modified: 'git-status-modified',
  added: 'git-status-added',
  deleted: 'git-status-deleted',
  untracked: 'git-status-untracked',
  renamed: 'git-status-renamed',
};

export class GitPanel {
  private container: HTMLElement | null = null;
  private isGitRepo = false;
  private currentBranch = '';
  private files: GitFileStatus[] = [];
  private collapsed = false;
  private stageCallback: ((paths: string[]) => void) | null = null;
  private unstageCallback: ((paths: string[]) => void) | null = null;
  private commitCallback: ((message: string) => void) | null = null;
  private commitInput: HTMLInputElement | null = null;
  private commitBtn: HTMLButtonElement | null = null;

  render(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'git-panel';
    this.container.style.display = 'none';
    parent.appendChild(this.container);
  }

  update(isGitRepo: boolean, branch: string, files: GitFileStatus[]): void {
    this.isGitRepo = isGitRepo;
    this.currentBranch = branch;
    this.files = files;
    this.renderPanel();
  }

  onStage(callback: (paths: string[]) => void): void {
    this.stageCallback = callback;
  }

  onUnstage(callback: (paths: string[]) => void): void {
    this.unstageCallback = callback;
  }

  onCommit(callback: (message: string) => void): void {
    this.commitCallback = callback;
  }

  /** Scroll to and focus the commit input area */
  focusCommitInput(): void {
    if (this.commitInput) {
      this.commitInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      this.commitInput.focus();
    }
  }

  dispose(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  private renderPanel(): void {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (!this.isGitRepo) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = '';

    // Header
    const header = document.createElement('div');
    header.className = 'git-panel-header';
    header.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.renderPanel();
    });

    const headerLabel = document.createElement('span');
    headerLabel.className = 'git-panel-header-label';
    headerLabel.textContent = 'Git';
    header.appendChild(headerLabel);

    const branchBadge = document.createElement('span');
    branchBadge.className = 'git-panel-branch-badge';
    branchBadge.textContent = this.currentBranch;
    header.appendChild(branchBadge);

    const chevron = document.createElement('span');
    chevron.className = 'git-panel-chevron';
    chevron.textContent = this.collapsed ? '\u25B6' : '\u25BC';
    header.appendChild(chevron);

    this.container.appendChild(header);

    if (this.collapsed) return;

    // Bulk actions
    const bulkActions = document.createElement('div');
    bulkActions.className = 'git-panel-bulk-actions';

    const stageAllBtn = document.createElement('button');
    stageAllBtn.className = 'git-panel-bulk-btn';
    stageAllBtn.textContent = 'Stage All';
    stageAllBtn.addEventListener('click', () => {
      const unstaged = this.files.filter((f) => !f.staged).map((f) => f.path);
      if (unstaged.length > 0) {
        this.stageCallback?.(unstaged);
      }
    });
    bulkActions.appendChild(stageAllBtn);

    const unstageAllBtn = document.createElement('button');
    unstageAllBtn.className = 'git-panel-bulk-btn';
    unstageAllBtn.textContent = 'Unstage All';
    unstageAllBtn.addEventListener('click', () => {
      const staged = this.files.filter((f) => f.staged).map((f) => f.path);
      if (staged.length > 0) {
        this.unstageCallback?.(staged);
      }
    });
    bulkActions.appendChild(unstageAllBtn);

    this.container.appendChild(bulkActions);

    // File list
    const fileList = document.createElement('div');
    fileList.className = 'git-panel-files';

    for (const file of this.files) {
      const row = document.createElement('div');
      row.className = 'git-panel-file';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'git-panel-file-checkbox';
      checkbox.checked = file.staged;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.stageCallback?.([file.path]);
        } else {
          this.unstageCallback?.([file.path]);
        }
      });
      row.appendChild(checkbox);

      const statusEl = document.createElement('span');
      statusEl.className = `git-panel-status ${STATUS_CLASSES[file.status]}`;
      statusEl.textContent = STATUS_LABELS[file.status];
      row.appendChild(statusEl);

      const pathEl = document.createElement('span');
      pathEl.className = 'git-panel-file-path';
      pathEl.textContent = file.path;
      pathEl.title = file.path;
      row.appendChild(pathEl);

      fileList.appendChild(row);
    }

    this.container.appendChild(fileList);

    // Commit area
    const commitArea = document.createElement('div');
    commitArea.className = 'git-panel-commit';

    const stagedCount = this.files.filter((f) => f.staged).length;

    const stagedLabel = document.createElement('span');
    stagedLabel.className = 'git-panel-staged-count';
    stagedLabel.textContent = `${stagedCount} file${stagedCount !== 1 ? 's' : ''} staged`;
    commitArea.appendChild(stagedLabel);

    const commitInput = document.createElement('input');
    commitInput.type = 'text';
    commitInput.className = 'git-panel-commit-input';
    commitInput.placeholder = 'Commit message';
    commitInput.addEventListener('input', () => {
      this.updateCommitButtonState();
    });
    commitArea.appendChild(commitInput);
    this.commitInput = commitInput;

    const commitBtn = document.createElement('button');
    commitBtn.className = 'git-panel-commit-btn';
    commitBtn.textContent = 'Commit';
    commitBtn.disabled = true; // Disabled until conditions are met
    commitBtn.addEventListener('click', () => {
      const message = commitInput.value.trim();
      if (message && stagedCount > 0) {
        this.commitCallback?.(message);
        commitInput.value = '';
      }
    });
    commitArea.appendChild(commitBtn);
    this.commitBtn = commitBtn;

    this.container.appendChild(commitArea);
  }

  private updateCommitButtonState(): void {
    if (!this.commitBtn || !this.commitInput) return;
    const stagedCount = this.files.filter((f) => f.staged).length;
    const hasMessage = this.commitInput.value.trim().length > 0;
    this.commitBtn.disabled = stagedCount === 0 || !hasMessage;
  }
}
