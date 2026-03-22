import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBuildFromTemplate = vi.fn((template: unknown[]) => ({ items: template }));
const mockSetApplicationMenu = vi.fn();

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: mockBuildFromTemplate,
    setApplicationMenu: mockSetApplicationMenu,
  },
  app: {
    name: 'mdview',
  },
}));

const { buildApplicationMenu } = await import('./menu');

function createMockDeps() {
  return {
    onOpenFile: vi.fn(),
    onOpenFolder: vi.fn(),
    getRecentFiles: vi.fn().mockReturnValue([]),
    onClearRecent: vi.fn(),
    onCloseTab: vi.fn(),
    onToggleSidebar: vi.fn(),
    onToggleToc: vi.fn(),
    onToggleTabBar: vi.fn(),
    onToggleHeaderBar: vi.fn(),
    onToggleStatusBar: vi.fn(),
    onMenuCommand: vi.fn(),
  };
}

describe('buildApplicationMenu', () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
  });

  it('should build and set the application menu', () => {
    buildApplicationMenu(deps);
    expect(mockBuildFromTemplate).toHaveBeenCalled();
    expect(mockSetApplicationMenu).toHaveBeenCalled();
  });

  it('should include File, Edit, View, Export, and Help menus', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      role?: string;
    }>;
    const labels = template.map((item) => item.label ?? item.role);
    expect(labels).toContain('File');
    expect(labels).toContain('Edit');
    expect(labels).toContain('View');
    expect(labels).toContain('Export');
    expect(labels).toContain('Help');
  });

  it('should call onOpenFile when Open File is clicked', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{ label?: string; click?: () => void }>;
    }>;
    const fileMenu = template.find((item) => item.label === 'File');
    const openItem = fileMenu?.submenu?.find((item) => item.label === 'Open File...');
    openItem?.click?.();
    expect(deps.onOpenFile).toHaveBeenCalled();
  });

  it('should call onOpenFolder when Open Folder is clicked', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{ label?: string; click?: () => void }>;
    }>;
    const fileMenu = template.find((item) => item.label === 'File');
    const openFolder = fileMenu?.submenu?.find((item) => item.label === 'Open Folder...');
    openFolder?.click?.();
    expect(deps.onOpenFolder).toHaveBeenCalled();
  });

  it('should populate Recent Files submenu', () => {
    deps.getRecentFiles.mockReturnValue(['/tmp/a.md', '/tmp/b.md']);
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{
        label?: string;
        submenu?: Array<{ label?: string; click?: () => void }>;
      }>;
    }>;
    const fileMenu = template.find((item) => item.label === 'File');
    const recentItem = fileMenu?.submenu?.find((item) => item.label === 'Recent Files');
    expect(recentItem?.submenu).toBeDefined();
    // File entries + separator + clear
    expect(recentItem?.submenu?.length).toBe(4);
  });

  it('should call onCloseTab from File > Close Tab', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{ label?: string; click?: () => void }>;
    }>;
    const fileMenu = template.find((item) => item.label === 'File');
    const closeItem = fileMenu?.submenu?.find((item) => item.label === 'Close Tab');
    closeItem?.click?.();
    expect(deps.onCloseTab).toHaveBeenCalled();
  });

  it('should call onToggleSidebar from View menu', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{ label?: string; click?: () => void }>;
    }>;
    const viewMenu = template.find((item) => item.label === 'View');
    const toggleSidebar = viewMenu?.submenu?.find((item) => item.label === 'Toggle Sidebar');
    toggleSidebar?.click?.();
    expect(deps.onToggleSidebar).toHaveBeenCalled();
  });

  it('should include Export... item with CmdOrCtrl+E accelerator', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{ label?: string; accelerator?: string; click?: () => void }>;
    }>;
    const exportMenu = template.find((item) => item.label === 'Export');
    const exportItem = exportMenu?.submenu?.find((item) => item.label === 'Export...');
    expect(exportItem).toBeDefined();
    expect(exportItem?.accelerator).toBe('CmdOrCtrl+E');
    exportItem?.click?.();
    expect(deps.onMenuCommand).toHaveBeenCalledWith('export:modal');
  });

  it('should include Preferences item in macOS app menu', () => {
    buildApplicationMenu(deps);
    const template = mockBuildFromTemplate.mock.calls[0][0] as Array<{
      label?: string;
      submenu?: Array<{ label?: string; accelerator?: string; click?: () => void }>;
    }>;
    const appMenu = template.find((item) => item.label === 'mdview');
    const prefsItem = appMenu?.submenu?.find((item) => item.label === 'Preferences...');
    expect(prefsItem).toBeDefined();
    expect(prefsItem?.accelerator).toBe('CmdOrCtrl+,');
    prefsItem?.click?.();
    expect(deps.onMenuCommand).toHaveBeenCalledWith('preferences');
  });
});
