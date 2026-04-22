const GIT_BRANCH_ICON = `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25z" fill="currentColor"/></svg>`;

export class BranchSelector {
  private container: HTMLElement | null = null;
  private currentBranch = '';
  private branches: string[] = [];
  private isGitRepo = false;
  private checkoutCallback: ((branch: string) => void) | null = null;
  private activeDropdown: HTMLElement | null = null;
  private dropdownDismissHandler: (() => void) | null = null;

  render(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'branch-selector';
    this.container.style.display = 'none';
    parent.appendChild(this.container);
  }

  update(isGitRepo: boolean, currentBranch: string, branches: string[]): void {
    this.isGitRepo = isGitRepo;
    this.currentBranch = currentBranch;
    this.branches = branches;
    this.renderButton();
  }

  onCheckout(callback: (branch: string) => void): void {
    this.checkoutCallback = callback;
  }

  dispose(): void {
    this.dismissDropdown();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  private renderButton(): void {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (!this.isGitRepo) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = '';

    const btn = document.createElement('button');
    btn.className = 'branch-selector-btn';
    btn.innerHTML = GIT_BRANCH_ICON;

    const label = document.createElement('span');
    label.className = 'branch-selector-label';
    label.textContent = this.currentBranch;
    btn.appendChild(label);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(btn);
    });

    this.container.appendChild(btn);
  }

  private toggleDropdown(anchorEl: HTMLElement): void {
    if (this.activeDropdown) {
      this.dismissDropdown();
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'branch-selector-dropdown';

    for (const branch of this.branches) {
      const item = document.createElement('div');
      item.className = 'branch-selector-item';

      if (branch === this.currentBranch) {
        item.classList.add('current');
      }

      const checkmark = document.createElement('span');
      checkmark.className = 'branch-selector-checkmark';
      checkmark.textContent = branch === this.currentBranch ? '\u2713' : '';
      item.appendChild(checkmark);

      const label = document.createElement('span');
      label.className = 'branch-selector-item-label';
      label.textContent = branch;
      item.appendChild(label);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissDropdown();
        if (branch !== this.currentBranch) {
          this.checkoutCallback?.(branch);
        }
      });

      dropdown.appendChild(item);
    }

    // Position fixed on body using anchor rect
    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 2}px`;
    dropdown.style.left = `${rect.left}px`;

    document.body.appendChild(dropdown);
    this.activeDropdown = dropdown;

    this.dropdownDismissHandler = () => {
      this.dismissDropdown();
    };
    setTimeout(() => {
      document.addEventListener('click', this.dropdownDismissHandler!);
    }, 0);
  }

  private dismissDropdown(): void {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
    if (this.dropdownDismissHandler) {
      document.removeEventListener('click', this.dropdownDismissHandler);
      this.dropdownDismissHandler = null;
    }
  }
}
