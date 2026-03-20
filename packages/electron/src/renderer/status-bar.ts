export interface StatusBarData {
  filePath?: string;
  wordCount?: number;
  headingCount?: number;
  diagramCount?: number;
  codeBlockCount?: number;
  themeName?: string;
  renderState?: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function pluralize(count: number, singular: string): string {
  return `${formatNumber(count)} ${singular}${count === 1 ? '' : 's'}`;
}

export class StatusBar {
  private container: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;

  render(parent: HTMLElement): void {
    this.container = parent;
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'status-bar-content';
    parent.appendChild(this.contentEl);
  }

  update(data: StatusBarData): void {
    if (!this.contentEl) return;

    const segments: string[] = [];

    if (data.filePath) {
      segments.push(data.filePath.split('/').pop() ?? data.filePath);
    }

    if (data.wordCount !== undefined) {
      segments.push(pluralize(data.wordCount, 'word'));
    }

    if (data.headingCount !== undefined) {
      segments.push(pluralize(data.headingCount, 'heading'));
    }

    if (data.codeBlockCount !== undefined) {
      segments.push(pluralize(data.codeBlockCount, 'code block'));
    }

    if (data.diagramCount !== undefined) {
      segments.push(pluralize(data.diagramCount, 'diagram'));
    }

    if (data.themeName) {
      segments.push(data.themeName);
    }

    if (data.renderState) {
      segments.push(data.renderState);
    }

    this.contentEl.textContent = segments.join('  \u00b7  ');
  }

  clear(): void {
    if (this.contentEl) {
      this.contentEl.textContent = '';
    }
  }

  showProgress(progress: { stage: string; percent: number }): void {
    if (!this.container) return;

    if (!this.progressEl) {
      this.progressEl = document.createElement('div');
      this.progressEl.className = 'status-bar-progress';
      this.container.appendChild(this.progressEl);
    }

    const clampedPercent = Math.max(0, Math.min(100, progress.percent));

    this.progressEl.innerHTML = '';

    const label = document.createElement('span');
    label.textContent = progress.stage;
    this.progressEl.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'status-bar-progress-bar';

    const fill = document.createElement('div');
    fill.className = 'status-bar-progress-fill';
    fill.style.width = `${clampedPercent}%`;

    bar.appendChild(fill);
    this.progressEl.appendChild(bar);
  }

  hideProgress(): void {
    if (this.progressEl) {
      this.progressEl.remove();
      this.progressEl = null;
    }
  }

  setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? '' : 'none';
    }
  }
}
