export interface DragDropOptions {
  target: HTMLElement;
  onFilesDropped: (paths: string[]) => void;
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']);

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

export function setupDragAndDrop(options: DragDropOptions): () => void {
  const { target, onFilesDropped } = options;

  const handleDragOver = (e: Event): void => {
    e.preventDefault();
    target.classList.add('mdreview-drag-over');
  };

  const handleDragLeave = (): void => {
    target.classList.remove('mdreview-drag-over');
  };

  const handleDrop = (e: Event): void => {
    e.preventDefault();
    target.classList.remove('mdreview-drag-over');

    const dataTransfer = (e as DragEvent).dataTransfer;
    if (!dataTransfer) return;

    const files = Array.from(dataTransfer.files) as Array<File & { path: string }>;
    const mdPaths = files
      .filter((file) => MARKDOWN_EXTENSIONS.has(getExtension(file.name)))
      .map((file) => file.path);

    if (mdPaths.length > 0) {
      onFilesDropped(mdPaths);
    }
  };

  target.addEventListener('dragover', handleDragOver);
  target.addEventListener('dragleave', handleDragLeave);
  target.addEventListener('drop', handleDrop);

  return () => {
    target.removeEventListener('dragover', handleDragOver);
    target.removeEventListener('dragleave', handleDragLeave);
    target.removeEventListener('drop', handleDrop);
  };
}
