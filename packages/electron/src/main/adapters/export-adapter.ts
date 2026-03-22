import type { ExportAdapter, ExportSaveOptions } from '@mdreview/core/node';
import { writeFile } from 'fs/promises';

type ShowSaveDialogFn = (options: {
  defaultPath: string;
  filters: { name: string; extensions: string[] }[];
}) => Promise<{ canceled: boolean; filePath?: string }>;

type PrintToPDFFn = (options?: {
  pageSize?: string;
  margins?: string;
  landscape?: boolean;
}) => Promise<Buffer>;

export class ElectronExportAdapter implements ExportAdapter {
  constructor(
    private showSaveDialog: ShowSaveDialogFn,
    private printToPDFFn: PrintToPDFFn
  ) {}

  async saveFile(options: ExportSaveOptions): Promise<void> {
    const filters = this.getFilters(options.mimeType, options.filename);

    const result = await this.showSaveDialog({
      defaultPath: options.filename,
      filters,
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    const buffer =
      options.data instanceof ArrayBuffer
        ? Buffer.from(options.data)
        : Buffer.from(await options.data.arrayBuffer());

    await writeFile(result.filePath, buffer);
  }

  async printToPDF(options?: {
    pageSize?: string;
    margins?: string;
    landscape?: boolean;
  }): Promise<ArrayBuffer> {
    const buffer = await this.printToPDFFn(options);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  private getFilters(mimeType: string, filename: string): { name: string; extensions: string[] }[] {
    const ext = filename.split('.').pop() || '';

    const mimeMap: Record<string, { name: string; extensions: string[] }> = {
      'application/pdf': { name: 'PDF', extensions: ['pdf'] },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        name: 'Word Document',
        extensions: ['docx'],
      },
      'text/html': { name: 'HTML', extensions: ['html', 'htm'] },
    };

    const filter = mimeMap[mimeType];
    if (filter) {
      return [filter, { name: 'All Files', extensions: ['*'] }];
    }

    return [
      { name: ext.toUpperCase(), extensions: [ext] },
      { name: 'All Files', extensions: ['*'] },
    ];
  }
}
