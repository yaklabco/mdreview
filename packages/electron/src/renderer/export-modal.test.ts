import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportModal } from './export-modal';

describe('ExportModal', () => {
  let modal: ExportModal;

  beforeEach(() => {
    document.body.innerHTML = '';
    modal = new ExportModal();
  });

  afterEach(() => {
    modal.dispose();
  });

  it('should create overlay and card when shown', () => {
    modal.show('readme.md');

    const overlay = document.querySelector('.export-modal-overlay');
    expect(overlay).not.toBeNull();

    const card = document.querySelector('.export-modal-card');
    expect(card).not.toBeNull();
  });

  it('should display document name in heading', () => {
    modal.show('readme.md');

    const heading = document.querySelector('.export-modal-card h3');
    expect(heading?.textContent).toContain('readme.md');
  });

  it('should show subtitle text', () => {
    modal.show('readme.md');

    const card = document.querySelector('.export-modal-card');
    expect(card?.textContent).toContain('Choose export format');
  });

  it('should have PDF and DOCX buttons', () => {
    modal.show('readme.md');

    const buttons = document.querySelectorAll('.export-modal-card button.export-modal-format-btn');
    expect(buttons.length).toBe(2);

    const labels = Array.from(buttons).map((b) => b.textContent);
    expect(labels).toContain('Export as PDF');
    expect(labels).toContain('Export as DOCX');
  });

  it('should have a close button', () => {
    modal.show('readme.md');

    const closeBtn = document.querySelector('.export-modal-close');
    expect(closeBtn).not.toBeNull();
  });

  it('should fire onExport callback with pdf when PDF button clicked', () => {
    const callback = vi.fn();
    modal.onExport(callback);
    modal.show('readme.md');

    const buttons = document.querySelectorAll('.export-modal-format-btn');
    const pdfBtn = Array.from(buttons).find((b) => b.textContent === 'Export as PDF') as HTMLElement;
    pdfBtn.click();

    expect(callback).toHaveBeenCalledWith('pdf');
  });

  it('should fire onExport callback with docx when DOCX button clicked', () => {
    const callback = vi.fn();
    modal.onExport(callback);
    modal.show('readme.md');

    const buttons = document.querySelectorAll('.export-modal-format-btn');
    const docxBtn = Array.from(buttons).find((b) => b.textContent === 'Export as DOCX') as HTMLElement;
    docxBtn.click();

    expect(callback).toHaveBeenCalledWith('docx');
  });

  it('should hide after format button is clicked', () => {
    modal.onExport(vi.fn());
    modal.show('readme.md');

    const pdfBtn = document.querySelector('.export-modal-format-btn') as HTMLElement;
    pdfBtn.click();

    expect(document.querySelector('.export-modal-overlay')).toBeNull();
  });

  it('should dismiss on Escape key', () => {
    modal.show('readme.md');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.export-modal-overlay')).toBeNull();
  });

  it('should dismiss on backdrop click', () => {
    modal.show('readme.md');

    const overlay = document.querySelector('.export-modal-overlay') as HTMLElement;
    overlay.click();

    expect(document.querySelector('.export-modal-overlay')).toBeNull();
  });

  it('should not dismiss when clicking inside card', () => {
    modal.show('readme.md');

    const card = document.querySelector('.export-modal-card') as HTMLElement;
    card.click();

    expect(document.querySelector('.export-modal-overlay')).not.toBeNull();
  });

  it('should dismiss on close button click', () => {
    modal.show('readme.md');

    const closeBtn = document.querySelector('.export-modal-close') as HTMLElement;
    closeBtn.click();

    expect(document.querySelector('.export-modal-overlay')).toBeNull();
  });

  it('should not create duplicate overlays when shown twice', () => {
    modal.show('readme.md');
    modal.show('other.md');

    const overlays = document.querySelectorAll('.export-modal-overlay');
    expect(overlays.length).toBe(1);
  });

  it('should hide cleanly when not shown', () => {
    // Should not throw
    expect(() => modal.hide()).not.toThrow();
  });

  it('should dispose and remove overlay', () => {
    modal.show('readme.md');
    modal.dispose();

    expect(document.querySelector('.export-modal-overlay')).toBeNull();
  });

  it('should clean up Escape listener on hide', () => {
    modal.show('readme.md');
    modal.hide();

    // Show again and dismiss — should still work, proving old listener was cleaned up
    modal.show('test.md');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.export-modal-overlay')).toBeNull();
  });
});
