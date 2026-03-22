export interface PreferencesPanelOptions {
  // General
  theme: string;
  autoTheme: boolean;
  lightTheme: string;
  darkTheme: string;
  autoReload: boolean;
  showAllFiles: boolean;
  iconTheme: string;
  // Display
  lineNumbers: boolean;
  enableHtml: boolean;
  fontFamily?: string;
  codeFontFamily?: string;
  lineHeight?: number;
  useMaxWidth?: boolean;
  maxWidth?: number;
  // TOC
  showToc: boolean;
  tocPosition: 'left' | 'right';
  tocMaxDepth: number;
  tocAutoCollapse: boolean;
  // Export
  exportDefaultFormat?: 'docx' | 'pdf';
  exportDefaultPageSize?: string;
  exportIncludeToc?: boolean;
  exportFilenameTemplate?: string;
}

export interface ThemeOption {
  name: string;
  displayName: string;
  variant: 'light' | 'dark';
}

type Category = 'General' | 'Display' | 'Table of Contents' | 'Export';

const CATEGORIES: Category[] = ['General', 'Display', 'Table of Contents', 'Export'];

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  General: 'Theme, auto-reload, and general behavior settings.',
  Display: 'Code rendering, typography, and layout options.',
  'Table of Contents': 'Configure the navigable table of contents panel.',
  Export: 'Default format, page size, and export options.',
};

export class PreferencesPanel {
  private overlay: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private groupsContainer: HTMLElement | null = null;
  private onEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
  private activeCategory: Category = 'General';
  private currentPrefs: PreferencesPanelOptions | null = null;
  private currentThemes: ThemeOption[] = [];

  show(currentPrefs: PreferencesPanelOptions, availableThemes: ThemeOption[]): void {
    if (this.overlay) return;

    this.currentPrefs = { ...currentPrefs };
    this.currentThemes = availableThemes;
    this.activeCategory = 'General';

    this.overlay = document.createElement('div');
    this.overlay.className = 'preferences-overlay';

    const panel = document.createElement('div');
    panel.className = 'preferences-panel';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'preferences-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    panel.appendChild(closeBtn);

    // Sidebar
    const sidebar = document.createElement('nav');
    sidebar.className = 'preferences-sidebar';

    for (const cat of CATEGORIES) {
      const item = document.createElement('button');
      item.className = 'preferences-sidebar-item';
      if (cat === this.activeCategory) item.classList.add('active');
      item.textContent = cat;
      item.addEventListener('click', () => this.switchCategory(cat, sidebar));
      sidebar.appendChild(item);
    }

    panel.appendChild(sidebar);

    // Content area
    this.contentArea = document.createElement('main');
    this.contentArea.className = 'preferences-content';
    this.renderCategory();
    panel.appendChild(this.contentArea);

    this.overlay.appendChild(panel);

    // Backdrop click closes
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Escape closes
    this.onEscapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.onEscapeHandler);

    document.body.appendChild(this.overlay);
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.contentArea = null;
      this.groupsContainer = null;
    }
    if (this.onEscapeHandler) {
      document.removeEventListener('keydown', this.onEscapeHandler);
      this.onEscapeHandler = null;
    }
  }

  dispose(): void {
    this.hide();
  }

  private switchCategory(cat: Category, sidebar: HTMLElement): void {
    this.activeCategory = cat;
    for (const item of sidebar.querySelectorAll('.preferences-sidebar-item')) {
      item.classList.toggle('active', item.textContent === cat);
    }
    this.renderCategory();
  }

  private renderCategory(): void {
    if (!this.contentArea || !this.currentPrefs) return;
    this.contentArea.innerHTML = '';

    // Category header
    const header = document.createElement('div');
    header.className = 'preferences-category-header';
    const h2 = document.createElement('h2');
    h2.textContent = this.activeCategory;
    const desc = document.createElement('p');
    desc.textContent = CATEGORY_DESCRIPTIONS[this.activeCategory];
    header.appendChild(h2);
    header.appendChild(desc);
    this.contentArea.appendChild(header);

    // Groups container
    this.groupsContainer = document.createElement('div');
    this.groupsContainer.className = 'preferences-groups';
    this.contentArea.appendChild(this.groupsContainer);

    switch (this.activeCategory) {
      case 'General':
        this.renderGeneral();
        break;
      case 'Display':
        this.renderDisplay();
        break;
      case 'Table of Contents':
        this.renderToc();
        break;
      case 'Export':
        this.renderExport();
        break;
    }
  }

  // --- Category renderers ---

  private renderGeneral(): void {
    const p = this.currentPrefs!;

    // Theme group
    const themeSelect = this.createThemeSelect(p.theme, this.currentThemes);
    const autoThemeToggle = this.createToggle(
      'Auto dark mode',
      'Automatically switch between light and dark themes',
      'autoTheme',
      p.autoTheme
    );

    // Conditional light/dark theme selectors
    const conditional = document.createElement('div');
    conditional.className = 'preferences-conditional';
    if (p.autoTheme) conditional.classList.add('expanded');

    const lightSelect = this.createSelect(
      'Light theme',
      'Theme used in light mode',
      'lightTheme',
      this.currentThemes
        .filter((t) => t.variant === 'light')
        .map((t) => ({ value: t.name, label: t.displayName })),
      p.lightTheme
    );
    const darkSelect = this.createSelect(
      'Dark theme',
      'Theme used in dark mode',
      'darkTheme',
      this.currentThemes
        .filter((t) => t.variant === 'dark')
        .map((t) => ({ value: t.name, label: t.displayName })),
      p.darkTheme
    );
    conditional.appendChild(lightSelect);
    conditional.appendChild(darkSelect);

    // Wire auto theme toggle to show/hide conditional
    const autoThemeInput = autoThemeToggle.querySelector('input') as HTMLInputElement;
    autoThemeInput.addEventListener('change', () => {
      conditional.classList.toggle('expanded', autoThemeInput.checked);
    });

    const iconThemeSelect = this.createSelect(
      'Icon theme',
      'Choose the file tree icon style',
      'iconTheme',
      [
        { value: 'lucide', label: 'Lucide' },
        { value: 'codicons', label: 'Codicons' },
        { value: 'symbols', label: 'Symbols' },
        { value: 'one-dark', label: 'One Dark' },
        { value: 'material', label: 'Material' },
        { value: 'catppuccin', label: 'Catppuccin' },
        { value: 'seti', label: 'Seti' },
      ],
      p.iconTheme
    );

    this.groupsContainer!.appendChild(
      this.createGroup([themeSelect, autoThemeToggle, conditional, iconThemeSelect])
    );

    // Behavior group
    const autoReloadToggle = this.createToggle(
      'Auto reload on file change',
      'Reload document when the file is modified',
      'autoReload',
      p.autoReload
    );
    const showAllFilesToggle = this.createToggle(
      'Show all files',
      'Display non-markdown files in the sidebar file tree',
      'showAllFiles',
      p.showAllFiles
    );
    this.groupsContainer!.appendChild(this.createGroup([autoReloadToggle, showAllFilesToggle]));
  }

  private renderDisplay(): void {
    const p = this.currentPrefs!;

    // Code group
    const lineNumbersToggle = this.createToggle(
      'Line numbers',
      'Show line numbers in code blocks',
      'lineNumbers',
      p.lineNumbers
    );
    const enableHtmlToggle = this.createToggle(
      'Render HTML',
      'Allow HTML tags in markdown',
      'enableHtml',
      p.enableHtml
    );
    this.groupsContainer!.appendChild(this.createGroup([lineNumbersToggle, enableHtmlToggle]));

    // Typography group
    const fontInput = this.createTextInput(
      'Font family',
      'Body text font',
      'fontFamily',
      p.fontFamily ?? '',
      'System default'
    );
    const codeFontInput = this.createTextInput(
      'Code font family',
      'Monospace font for code',
      'codeFontFamily',
      p.codeFontFamily ?? '',
      'System monospace'
    );
    const lineHeightInput = this.createNumberInput(
      'Line height',
      'Line spacing multiplier',
      'lineHeight',
      p.lineHeight ?? 1.6,
      1.0,
      2.5,
      0.1
    );
    this.groupsContainer!.appendChild(
      this.createGroup([fontInput, codeFontInput, lineHeightInput])
    );

    // Layout group
    const maxWidthInput = this.createNumberInput(
      'Max width',
      'Maximum content width in pixels',
      'maxWidth',
      p.maxWidth ?? 980,
      600,
      2000,
      10
    );
    const maxWidthNumberEl = maxWidthInput.querySelector('input') as HTMLInputElement;
    maxWidthNumberEl.disabled = !p.useMaxWidth;

    const useMaxWidthToggle = this.createToggle(
      'Use max width',
      'Constrain content to a maximum width',
      'useMaxWidth',
      p.useMaxWidth ?? false
    );
    const useMaxWidthInput = useMaxWidthToggle.querySelector('input') as HTMLInputElement;
    useMaxWidthInput.addEventListener('change', () => {
      maxWidthNumberEl.disabled = !useMaxWidthInput.checked;
    });

    this.groupsContainer!.appendChild(this.createGroup([useMaxWidthToggle, maxWidthInput]));
  }

  private renderToc(): void {
    const p = this.currentPrefs!;

    const showTocToggle = this.createToggle(
      'Show table of contents',
      'Display a navigable TOC panel',
      'showToc',
      p.showToc
    );
    const positionSelect = this.createSelect(
      'Position',
      'Which side to show the TOC',
      'tocPosition',
      [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
      p.tocPosition
    );
    const maxDepthSelect = this.createSelect(
      'Max depth',
      'Deepest heading level to include',
      'tocMaxDepth',
      [
        { value: '2', label: 'H2 only' },
        { value: '3', label: 'Up to H3' },
        { value: '4', label: 'Up to H4' },
        { value: '5', label: 'Up to H5' },
        { value: '6', label: 'All levels' },
      ],
      String(p.tocMaxDepth)
    );
    const autoCollapseToggle = this.createToggle(
      'Auto-collapse',
      'Collapse nested sections automatically',
      'tocAutoCollapse',
      p.tocAutoCollapse
    );

    this.groupsContainer!.appendChild(
      this.createGroup([showTocToggle, positionSelect, maxDepthSelect, autoCollapseToggle])
    );
  }

  private renderExport(): void {
    const p = this.currentPrefs!;

    // Defaults group
    const formatSelect = this.createSelect(
      'Default format',
      'File format for exports',
      'exportDefaultFormat',
      [
        { value: 'pdf', label: 'PDF' },
        { value: 'docx', label: 'DOCX' },
      ],
      p.exportDefaultFormat ?? 'pdf'
    );

    const pageSizeSelect = this.createPageSizeSelect(p.exportDefaultPageSize ?? 'A4');

    this.groupsContainer!.appendChild(this.createGroup([formatSelect, pageSizeSelect]));

    // Options group
    const includeTocToggle = this.createToggle(
      'Include table of contents',
      'Add a TOC to exported documents',
      'exportIncludeToc',
      p.exportIncludeToc ?? false
    );

    const templateInput = this.createTextInput(
      'Filename template',
      'Template for export filenames',
      'exportFilenameTemplate',
      p.exportFilenameTemplate ?? '',
      '{title}-{date}'
    );

    // Live preview for filename template
    const preview = document.createElement('div');
    preview.className = 'preferences-filename-preview';
    preview.textContent = this.renderFilenamePreview(p.exportFilenameTemplate ?? '');

    const inputEl = templateInput.querySelector('input') as HTMLInputElement;
    inputEl.addEventListener('input', () => {
      preview.textContent = this.renderFilenamePreview(inputEl.value);
      this.currentPrefs!.exportFilenameTemplate = inputEl.value;
      void window.mdreview.updatePreferences({ exportFilenameTemplate: inputEl.value });
    });

    this.groupsContainer!.appendChild(this.createGroup([includeTocToggle, templateInput, preview]));
  }

  // --- Control factories ---

  private createToggle(
    label: string,
    description: string,
    prefKey: string,
    value: boolean
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preferences-row';

    const labelCol = document.createElement('div');
    labelCol.className = 'preferences-row-label';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const descSpan = document.createElement('span');
    descSpan.textContent = description;
    labelCol.appendChild(labelSpan);
    labelCol.appendChild(descSpan);

    const toggle = document.createElement('label');
    toggle.className = 'preferences-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.setAttribute('data-pref', prefKey);
    input.addEventListener('change', () => {
      this.currentPrefs![prefKey as keyof PreferencesPanelOptions] = input.checked as never;
      void window.mdreview.updatePreferences({ [prefKey]: input.checked });
    });
    const slider = document.createElement('span');
    slider.className = 'preferences-toggle-slider';
    toggle.appendChild(input);
    toggle.appendChild(slider);

    row.appendChild(labelCol);
    row.appendChild(toggle);
    return row;
  }

  private createSelect(
    label: string,
    description: string,
    prefKey: string,
    options: { value: string; label: string }[],
    value: string
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preferences-row';

    const labelCol = document.createElement('div');
    labelCol.className = 'preferences-row-label';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const descSpan = document.createElement('span');
    descSpan.textContent = description;
    labelCol.appendChild(labelSpan);
    labelCol.appendChild(descSpan);

    const select = document.createElement('select');
    select.className = 'preferences-select';
    select.setAttribute('data-pref', prefKey);
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      const newVal = prefKey === 'tocMaxDepth' ? Number(select.value) : select.value;
      (this.currentPrefs as Record<string, unknown>)[prefKey] = newVal;
      void window.mdreview.updatePreferences({ [prefKey]: newVal });
    });

    row.appendChild(labelCol);
    row.appendChild(select);
    return row;
  }

  private createTextInput(
    label: string,
    description: string,
    prefKey: string,
    value: string,
    placeholder: string
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preferences-row';

    const labelCol = document.createElement('div');
    labelCol.className = 'preferences-row-label';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const descSpan = document.createElement('span');
    descSpan.textContent = description;
    labelCol.appendChild(labelSpan);
    labelCol.appendChild(descSpan);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'preferences-text-input';
    input.value = value;
    input.placeholder = placeholder;
    input.setAttribute('data-pref', prefKey);
    input.addEventListener('change', () => {
      (this.currentPrefs as Record<string, unknown>)[prefKey] = input.value || undefined;
      void window.mdreview.updatePreferences({
        [prefKey]: input.value || undefined,
      });
    });

    row.appendChild(labelCol);
    row.appendChild(input);
    return row;
  }

  private createNumberInput(
    label: string,
    description: string,
    prefKey: string,
    value: number,
    min: number,
    max: number,
    step: number
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preferences-row';

    const labelCol = document.createElement('div');
    labelCol.className = 'preferences-row-label';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const descSpan = document.createElement('span');
    descSpan.textContent = description;
    labelCol.appendChild(labelSpan);
    labelCol.appendChild(descSpan);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'preferences-number-input';
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('data-pref', prefKey);
    input.addEventListener('change', () => {
      const numVal = Number(input.value);
      (this.currentPrefs as Record<string, unknown>)[prefKey] = numVal;
      void window.mdreview.updatePreferences({ [prefKey]: numVal });
    });

    row.appendChild(labelCol);
    row.appendChild(input);
    return row;
  }

  private createGroup(controls: HTMLElement[]): HTMLElement {
    const group = document.createElement('div');
    group.className = 'preferences-group';
    for (const ctrl of controls) {
      group.appendChild(ctrl);
    }
    return group;
  }

  private createThemeSelect(currentTheme: string, themes: ThemeOption[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preferences-row';

    const labelCol = document.createElement('div');
    labelCol.className = 'preferences-row-label';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'Theme';
    const descSpan = document.createElement('span');
    descSpan.textContent = 'Color scheme for the viewer';
    labelCol.appendChild(labelSpan);
    labelCol.appendChild(descSpan);

    const select = document.createElement('select');
    select.className = 'preferences-select';
    select.setAttribute('data-pref', 'theme');

    const lightGroup = document.createElement('optgroup');
    lightGroup.label = 'Light';
    const darkGroup = document.createElement('optgroup');
    darkGroup.label = 'Dark';

    for (const theme of themes) {
      const option = document.createElement('option');
      option.value = theme.name;
      option.textContent = theme.displayName;
      if (theme.name === currentTheme) option.selected = true;
      if (theme.variant === 'light') {
        lightGroup.appendChild(option);
      } else {
        darkGroup.appendChild(option);
      }
    }

    select.appendChild(lightGroup);
    select.appendChild(darkGroup);
    select.addEventListener('change', () => {
      this.currentPrefs!.theme = select.value;
      void window.mdreview.updatePreferences({ theme: select.value });
    });

    row.appendChild(labelCol);
    row.appendChild(select);
    return row;
  }

  private createPageSizeSelect(currentSize: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preferences-row';

    const labelCol = document.createElement('div');
    labelCol.className = 'preferences-row-label';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'Page size';
    const descSpan = document.createElement('span');
    descSpan.textContent = 'Default page size for exports';
    labelCol.appendChild(labelSpan);
    labelCol.appendChild(descSpan);

    const select = document.createElement('select');
    select.className = 'preferences-select';
    select.setAttribute('data-pref', 'exportDefaultPageSize');

    const isoGroup = document.createElement('optgroup');
    isoGroup.label = 'ISO';
    for (const size of ['A0', 'A1', 'A3', 'A4', 'A5', 'A6']) {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      if (size === currentSize) option.selected = true;
      isoGroup.appendChild(option);
    }

    const naGroup = document.createElement('optgroup');
    naGroup.label = 'North American';
    for (const size of ['Letter', 'Legal', 'Tabloid', 'Executive']) {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      if (size === currentSize) option.selected = true;
      naGroup.appendChild(option);
    }

    select.appendChild(isoGroup);
    select.appendChild(naGroup);
    select.addEventListener('change', () => {
      (this.currentPrefs as Record<string, unknown>).exportDefaultPageSize = select.value;
      void window.mdreview.updatePreferences({ exportDefaultPageSize: select.value });
    });

    row.appendChild(labelCol);
    row.appendChild(select);
    return row;
  }

  private renderFilenamePreview(template: string): string {
    if (!template) return 'Preview: document.pdf';
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return `Preview: ${template.replace('{title}', 'document').replace('{date}', date)}`;
  }
}
