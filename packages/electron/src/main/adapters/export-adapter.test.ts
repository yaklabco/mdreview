import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronExportAdapter } from './export-adapter';
import type { ExportSaveOptions } from '@mdview/core/node';

describe('ElectronExportAdapter', () => {
  let showSaveDialog: ReturnType<typeof vi.fn>;
  let printToPDF: ReturnType<typeof vi.fn>;
  let adapter: ElectronExportAdapter;

  beforeEach(() => {
    showSaveDialog = vi.fn();
    printToPDF = vi.fn();
    adapter = new ElectronExportAdapter(showSaveDialog, printToPDF);
  });

  describe('saveFile', () => {
    it('should call showSaveDialog with correct filters', async () => {
      showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.pdf' });

      const options: ExportSaveOptions = {
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        data: new ArrayBuffer(10),
      };

      await adapter.saveFile(options);

      expect(showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: 'document.pdf',
        })
      );
    });

    it('should not write if dialog is canceled', async () => {
      showSaveDialog.mockResolvedValue({ canceled: true });

      const options: ExportSaveOptions = {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        data: new ArrayBuffer(0),
      };

      await adapter.saveFile(options);
      // No error thrown — dialog canceled gracefully
    });

    it('should handle DOCX mime type', async () => {
      showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.docx' });

      const options: ExportSaveOptions = {
        filename: 'doc.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: new ArrayBuffer(5),
      };

      await adapter.saveFile(options);

      const callArgs = showSaveDialog.mock.calls[0]?.[0] as {
        filters: { name: string; extensions: string[] }[];
      };
      const hasDocx = callArgs.filters.some((f: { extensions: string[] }) =>
        f.extensions.includes('docx')
      );
      expect(hasDocx).toBe(true);
    });
  });

  describe('printToPDF', () => {
    it('should delegate to the injected printToPDF function', async () => {
      const pdfBuffer = new ArrayBuffer(100);
      printToPDF.mockResolvedValue(Buffer.from(pdfBuffer));

      const result: ArrayBuffer = await adapter.printToPDF({ pageSize: 'A4' });
      expect(printToPDF).toHaveBeenCalledWith({ pageSize: 'A4' });
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should pass default empty options', async () => {
      printToPDF.mockResolvedValue(Buffer.from(new ArrayBuffer(0)));

      await adapter.printToPDF();
      expect(printToPDF).toHaveBeenCalledWith(undefined);
    });
  });
});
