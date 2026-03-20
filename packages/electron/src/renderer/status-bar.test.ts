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
});
