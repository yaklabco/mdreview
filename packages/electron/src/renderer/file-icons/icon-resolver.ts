import type { IconTheme, IconThemeId } from './types';
import { THEME_REGISTRY } from './themes';

let currentTheme: IconTheme = THEME_REGISTRY['lucide'];

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp']);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
  '.html', '.css', '.sh', '.rb', '.java', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.swift', '.kt', '.scala', '.lua',
  '.php', '.r', '.sql', '.zig', '.asm', '.vue', '.svelte',
]);

const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.xml', '.lock',
  '.env', '.ini', '.cfg', '.conf', '.properties',
  '.editorconfig', '.gitignore', '.npmrc',
]);

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0) return '';
  if (dotIndex === 0) return name.toLowerCase();
  return name.slice(dotIndex).toLowerCase();
}

export function setIconTheme(id: IconThemeId): void {
  currentTheme = THEME_REGISTRY[id];
}

export function getIconTheme(): IconThemeId {
  return currentTheme.id;
}

export function getFileIconSVG(name: string, isDirectory: boolean, expanded?: boolean): string {
  if (isDirectory) {
    return expanded ? currentTheme.folderOpen : currentTheme.folder;
  }

  const ext = getExtension(name);

  if (MD_EXTENSIONS.has(ext)) return currentTheme.markdown;
  if (IMAGE_EXTENSIONS.has(ext)) return currentTheme.image;
  if (CODE_EXTENSIONS.has(ext)) return currentTheme.code;
  if (CONFIG_EXTENSIONS.has(ext)) return currentTheme.config;

  return currentTheme.genericFile;
}

export function isMarkdownFile(name: string): boolean {
  return MD_EXTENSIONS.has(getExtension(name));
}
