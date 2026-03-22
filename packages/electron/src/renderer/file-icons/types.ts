export type IconThemeId = 'lucide' | 'codicons' | 'symbols' | 'one-dark' | 'material' | 'catppuccin' | 'seti';

export interface IconTheme {
  id: IconThemeId;
  displayName: string;
  folder: string;
  folderOpen: string;
  markdown: string;
  image: string;
  code: string;
  config: string;
  genericFile: string;
}
