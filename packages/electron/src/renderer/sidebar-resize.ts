const MIN_WIDTH = 150;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 250;

export class SidebarResizeHandle {
  private handleEl: HTMLDivElement | null = null;
  private isDragging = false;
  private startX = 0;
  private startWidth = 0;

  // Bound references for cleanup
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: (() => void) | null = null;
  private boundDblClick: (() => void) | null = null;

  onResize: ((width: number) => void) | null = null;

  constructor(private sidebar: HTMLElement) {}

  render(parent: HTMLElement): void {
    this.handleEl = document.createElement('div');
    this.handleEl.className = 'sidebar-resize-handle';

    // Insert after sidebar (before #mdreview-main)
    const main = parent.querySelector('#mdreview-main');
    if (main) {
      parent.insertBefore(this.handleEl, main);
    } else {
      parent.appendChild(this.handleEl);
    }

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundDblClick = this.onDblClick.bind(this);

    this.handleEl.addEventListener('mousedown', this.boundMouseDown);
    this.handleEl.addEventListener('dblclick', this.boundDblClick);
  }

  setSidebarWidth(width: number): void {
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
    this.sidebar.style.width = `${clamped}px`;
  }

  dispose(): void {
    if (this.handleEl) {
      if (this.boundMouseDown) {
        this.handleEl.removeEventListener('mousedown', this.boundMouseDown);
      }
      if (this.boundDblClick) {
        this.handleEl.removeEventListener('dblclick', this.boundDblClick);
      }
      this.handleEl.remove();
    }

    // Clean up document-level listeners if dragging was in progress
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
    }

    this.handleEl = null;
    this.boundMouseDown = null;
    this.boundMouseMove = null;
    this.boundMouseUp = null;
    this.boundDblClick = null;
  }

  private onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.isDragging = true;
    this.startX = e.clientX;
    this.startWidth =
      parseInt(this.sidebar.style.width, 10) || this.sidebar.getBoundingClientRect().width;

    this.handleEl?.classList.add('dragging');

    if (this.boundMouseMove) {
      document.addEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseUp) {
      document.addEventListener('mouseup', this.boundMouseUp);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const delta = e.clientX - this.startX;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, this.startWidth + delta));
    this.sidebar.style.width = `${newWidth}px`;
  }

  private onMouseUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    this.handleEl?.classList.remove('dragging');

    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
    }

    const finalWidth = parseInt(this.sidebar.style.width, 10);
    if (this.onResize && !isNaN(finalWidth)) {
      this.onResize(finalWidth);
    }
  }

  private onDblClick(): void {
    this.sidebar.style.width = `${DEFAULT_WIDTH}px`;
    if (this.onResize) {
      this.onResize(DEFAULT_WIDTH);
    }
  }
}
