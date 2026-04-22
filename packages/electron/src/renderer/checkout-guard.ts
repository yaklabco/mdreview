export interface CheckoutGuardOptions {
  targetBranch: string;
  dirtyFileCount: number;
  onCommitFirst: () => void;
  onStash: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export class CheckoutGuard {
  private overlay: HTMLElement | null = null;
  private onEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

  show(options: CheckoutGuardOptions): void {
    if (this.overlay) {
      this.dismiss();
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'checkout-guard-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'checkout-guard-dialog';

    // Title
    const title = document.createElement('h3');
    title.className = 'checkout-guard-title';
    title.textContent = 'Unsaved Changes';
    dialog.appendChild(title);

    // Message
    const message = document.createElement('p');
    message.className = 'checkout-guard-message';
    message.innerHTML = `You have ${options.dirtyFileCount} changed file${options.dirtyFileCount !== 1 ? 's' : ''}. What would you like to do before switching to <code>${options.targetBranch}</code>?`;
    dialog.appendChild(message);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'checkout-guard-actions';

    // Commit First (primary)
    const commitBtn = document.createElement('button');
    commitBtn.className = 'checkout-guard-btn primary';
    commitBtn.textContent = 'Commit First';
    commitBtn.addEventListener('click', () => {
      this.dismiss();
      options.onCommitFirst();
    });
    actions.appendChild(commitBtn);

    // Stash Changes
    const stashBtn = document.createElement('button');
    stashBtn.className = 'checkout-guard-btn';
    stashBtn.textContent = 'Stash Changes';
    stashBtn.addEventListener('click', () => {
      this.dismiss();
      options.onStash();
    });
    actions.appendChild(stashBtn);

    // Discard Changes (destructive)
    const discardBtn = document.createElement('button');
    discardBtn.className = 'checkout-guard-btn destructive';
    discardBtn.textContent = 'Discard Changes';
    discardBtn.addEventListener('click', () => {
      this.showDiscardConfirmation(actions, discardBtn, options);
    });
    actions.appendChild(discardBtn);

    // Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'checkout-guard-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      this.dismiss();
      options.onCancel();
    });
    actions.appendChild(cancelBtn);

    dialog.appendChild(actions);
    this.overlay.appendChild(dialog);

    // Backdrop click dismisses
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.dismiss();
        options.onCancel();
      }
    });

    // Escape key dismisses
    this.onEscapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.dismiss();
        options.onCancel();
      }
    };
    document.addEventListener('keydown', this.onEscapeHandler);

    document.body.appendChild(this.overlay);
  }

  dismiss(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.onEscapeHandler) {
      document.removeEventListener('keydown', this.onEscapeHandler);
      this.onEscapeHandler = null;
    }
  }

  private showDiscardConfirmation(
    actionsContainer: HTMLElement,
    discardBtn: HTMLElement,
    options: CheckoutGuardOptions
  ): void {
    // Replace discard button with confirmation
    const confirmation = document.createElement('div');
    confirmation.className = 'checkout-guard-confirm';

    const warning = document.createElement('span');
    warning.className = 'checkout-guard-confirm-text';
    warning.textContent = 'Are you sure? This cannot be undone.';
    confirmation.appendChild(warning);

    const confirmBtns = document.createElement('div');
    confirmBtns.className = 'checkout-guard-confirm-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'checkout-guard-btn destructive';
    confirmBtn.textContent = 'Confirm Discard';
    confirmBtn.addEventListener('click', () => {
      this.dismiss();
      options.onDiscard();
    });
    confirmBtns.appendChild(confirmBtn);

    const cancelConfirmBtn = document.createElement('button');
    cancelConfirmBtn.className = 'checkout-guard-btn';
    cancelConfirmBtn.textContent = 'Back';
    cancelConfirmBtn.addEventListener('click', () => {
      confirmation.remove();
      discardBtn.style.display = '';
    });
    confirmBtns.appendChild(cancelConfirmBtn);

    confirmation.appendChild(confirmBtns);

    // Hide the discard button and insert confirmation after it
    discardBtn.style.display = 'none';
    actionsContainer.insertBefore(confirmation, discardBtn.nextSibling);
  }
}
