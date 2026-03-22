export class ExportModal {
  private overlay: HTMLElement | null = null;
  private onEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
  private exportCallback: ((format: 'pdf' | 'docx') => void) | null = null;

  show(documentName: string): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'export-modal-overlay';

    const card = document.createElement('div');
    card.className = 'export-modal-card';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'export-modal-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    card.appendChild(closeBtn);

    // Heading
    const heading = document.createElement('h3');
    heading.textContent = documentName;
    card.appendChild(heading);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'export-modal-subtitle';
    subtitle.textContent = 'Choose export format';
    card.appendChild(subtitle);

    // Format buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'export-modal-buttons';

    const pdfBtn = document.createElement('button');
    pdfBtn.className = 'export-modal-format-btn';
    pdfBtn.textContent = 'Export as PDF';
    pdfBtn.addEventListener('click', () => {
      this.exportCallback?.('pdf');
      this.hide();
    });
    btnContainer.appendChild(pdfBtn);

    const docxBtn = document.createElement('button');
    docxBtn.className = 'export-modal-format-btn';
    docxBtn.textContent = 'Export as DOCX';
    docxBtn.addEventListener('click', () => {
      this.exportCallback?.('docx');
      this.hide();
    });
    btnContainer.appendChild(docxBtn);

    card.appendChild(btnContainer);
    this.overlay.appendChild(card);

    // Backdrop click dismisses (but not card clicks)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Escape dismisses
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
    }
    if (this.onEscapeHandler) {
      document.removeEventListener('keydown', this.onEscapeHandler);
      this.onEscapeHandler = null;
    }
  }

  onExport(callback: (format: 'pdf' | 'docx') => void): void {
    this.exportCallback = callback;
  }

  dispose(): void {
    this.hide();
  }
}
