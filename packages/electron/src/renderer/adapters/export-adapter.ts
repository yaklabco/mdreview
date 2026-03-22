import type { ExportAdapter, ExportSaveOptions } from '@mdreview/core';

export class ElectronRendererExportAdapter implements ExportAdapter {
  async saveFile(options: ExportSaveOptions): Promise<void> {
    const data =
      options.data instanceof ArrayBuffer ? options.data : await options.data.arrayBuffer();

    return window.mdreview.saveFile({
      filename: options.filename,
      mimeType: options.mimeType,
      data,
    });
  }

  async printToPDF(options?: {
    pageSize?: string;
    margins?: string;
    landscape?: boolean;
  }): Promise<ArrayBuffer> {
    return window.mdreview.printToPDF(options);
  }
}
