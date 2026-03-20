export interface PreferencesPanelOptions {
  theme: string;
  autoReload: boolean;
  showToc: boolean;
  commentsEnabled: boolean;
  autoDarkMode: boolean;
}

export interface ThemeOption {
  name: string;
  displayName: string;
  variant: 'light' | 'dark';
}

export class PreferencesPanel {
  private overlay: HTMLElement | null = null;
  private onEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

  show(currentPrefs: PreferencesPanelOptions, availableThemes: ThemeOption[]): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'preferences-overlay';

    const panel = document.createElement('div');
    panel.className = 'preferences-panel';
    panel.style.position = 'relative';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'preferences-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());

    const title = document.createElement('h2');
    title.textContent = 'Preferences';

    const form = document.createElement('div');
    form.className = 'preferences-form';

    // Theme dropdown
    const themeLabel = document.createElement('label');
    themeLabel.textContent = 'Theme';
    const themeSelect = document.createElement('select');
    themeSelect.setAttribute('data-pref', 'theme');

    const lightGroup = document.createElement('optgroup');
    lightGroup.label = 'Light';
    const darkGroup = document.createElement('optgroup');
    darkGroup.label = 'Dark';

    for (const theme of availableThemes) {
      const option = document.createElement('option');
      option.value = theme.name;
      option.textContent = theme.displayName;
      if (theme.name === currentPrefs.theme) {
        option.selected = true;
      }
      if (theme.variant === 'light') {
        lightGroup.appendChild(option);
      } else {
        darkGroup.appendChild(option);
      }
    }

    themeSelect.appendChild(lightGroup);
    themeSelect.appendChild(darkGroup);
    themeSelect.addEventListener('change', () => {
      void window.mdview.updatePreferences({ theme: themeSelect.value });
    });
    themeLabel.appendChild(themeSelect);
    form.appendChild(themeLabel);

    // Auto-reload toggle
    form.appendChild(this.createToggle('Auto-reload on file change', 'autoReload', currentPrefs.autoReload));

    // Show TOC toggle
    form.appendChild(this.createToggle('Show table of contents', 'showToc', currentPrefs.showToc));

    // Comments toggle
    form.appendChild(this.createToggle('Enable comments', 'commentsEnabled', currentPrefs.commentsEnabled));

    // Auto dark mode toggle
    form.appendChild(this.createToggle('Auto dark mode', 'autoDarkMode', currentPrefs.autoDarkMode));

    panel.appendChild(closeBtn);
    panel.appendChild(title);
    panel.appendChild(form);
    this.overlay.appendChild(panel);

    // Backdrop click closes
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Escape closes
    this.onEscapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.onEscapeHandler);

    document.body.appendChild(this.overlay);
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.onEscapeHandler) {
      document.removeEventListener('keydown', this.onEscapeHandler);
      this.onEscapeHandler = null;
    }
  }

  dispose(): void {
    this.hide();
  }

  private createToggle(labelText: string, prefKey: string, initialValue: boolean): HTMLElement {
    const label = document.createElement('label');
    label.textContent = labelText;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialValue;
    checkbox.setAttribute('data-pref', prefKey);
    checkbox.addEventListener('change', () => {
      void window.mdview.updatePreferences({ [prefKey]: checkbox.checked });
    });
    label.appendChild(checkbox);
    return label;
  }
}
