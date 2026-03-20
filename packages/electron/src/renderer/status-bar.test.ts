import { describe, it, expect, beforeEach } from 'vitest';
import { StatusBar } from './status-bar';

describe('StatusBar', () => {
  let statusBar: StatusBar;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="mdview-status-bar"></div>';
    container = document.getElementById('mdview-status-bar') as HTMLElement;
    statusBar = new StatusBar();
    statusBar.render(container);
  });

  it('should render into the container', () => {
    expect(container.querySelector('.status-bar-content')).not.toBeNull();
  });

  it('should update with file path', () => {
    statusBar.update({ filePath: '/tmp/docs/readme.md' });
    expect(container.textContent).toContain('readme.md');
  });

  it('should display word count', () => {
    statusBar.update({ filePath: '/tmp/test.md', wordCount: 1234 });
    expect(container.textContent).toContain('1,234');
    expect(container.textContent).toContain('words');
  });

  it('should display heading count', () => {
    statusBar.update({ filePath: '/tmp/test.md', headingCount: 5 });
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('heading');
  });

  it('should display code block count', () => {
    statusBar.update({ filePath: '/tmp/test.md', codeBlockCount: 3 });
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('code block');
  });

  it('should display diagram count', () => {
    statusBar.update({ filePath: '/tmp/test.md', diagramCount: 2 });
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('diagram');
  });

  it('should display theme name', () => {
    statusBar.update({ filePath: '/tmp/test.md', themeName: 'github-dark' });
    expect(container.textContent).toContain('github-dark');
  });

  it('should display render state', () => {
    statusBar.update({ filePath: '/tmp/test.md', renderState: 'rendering' });
    expect(container.textContent).toContain('rendering');
  });

  it('should clear all data', () => {
    statusBar.update({ filePath: '/tmp/test.md', wordCount: 100 });
    statusBar.clear();
    expect(container.querySelector('.status-bar-content')?.textContent).toBe('');
  });

  it('should toggle visibility', () => {
    statusBar.setVisible(false);
    expect(container.style.display).toBe('none');
    statusBar.setVisible(true);
    expect(container.style.display).toBe('');
  });

  it('should handle partial updates', () => {
    statusBar.update({ filePath: '/tmp/test.md', wordCount: 100, headingCount: 3 });
    expect(container.textContent).toContain('100');
    expect(container.textContent).toContain('3');
  });

  describe('progress indicator', () => {
    it('showProgress creates progress element with correct class', () => {
      statusBar.showProgress({ stage: 'parsing', percent: 50 });
      const progressEl = container.querySelector('.status-bar-progress');
      expect(progressEl).not.toBeNull();
      expect(progressEl?.parentElement).toBe(container);
    });

    it('showProgress displays the stage text', () => {
      statusBar.showProgress({ stage: 'highlighting', percent: 30 });
      const progressEl = container.querySelector('.status-bar-progress');
      expect(progressEl?.textContent).toContain('highlighting');
    });

    it('showProgress sets progress bar width to given percentage', () => {
      statusBar.showProgress({ stage: 'rendering', percent: 75 });
      const fill = container.querySelector('.status-bar-progress-fill') as HTMLElement;
      expect(fill).not.toBeNull();
      expect(fill.style.width).toBe('75%');
    });

    it('showProgress updates existing progress element on subsequent calls', () => {
      statusBar.showProgress({ stage: 'parsing', percent: 25 });
      statusBar.showProgress({ stage: 'highlighting', percent: 60 });
      const progressEls = container.querySelectorAll('.status-bar-progress');
      expect(progressEls.length).toBe(1);
      expect(progressEls[0].textContent).toContain('highlighting');
      const fill = container.querySelector('.status-bar-progress-fill') as HTMLElement;
      expect(fill.style.width).toBe('60%');
    });

    it('hideProgress removes the progress element', () => {
      statusBar.showProgress({ stage: 'parsing', percent: 50 });
      expect(container.querySelector('.status-bar-progress')).not.toBeNull();
      statusBar.hideProgress();
      expect(container.querySelector('.status-bar-progress')).toBeNull();
    });

    it('showProgress is a no-op when not rendered', () => {
      const unrendered = new StatusBar();
      unrendered.showProgress({ stage: 'parsing', percent: 50 });
      expect(container.querySelector('.status-bar-progress')).toBeNull();
    });

    it('hideProgress is a no-op when no progress element exists', () => {
      statusBar.hideProgress();
      expect(container.querySelector('.status-bar-progress')).toBeNull();
    });
  });
});
