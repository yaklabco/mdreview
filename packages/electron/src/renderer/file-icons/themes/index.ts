import type { IconTheme, IconThemeId } from '../types';
import { lucideTheme } from './lucide';
import { codiconsTheme } from './codicons';
import { symbolsTheme } from './symbols';
import { oneDarkTheme } from './one-dark';
import { materialTheme } from './material';
import { catppuccinTheme } from './catppuccin';
import { setiTheme } from './seti';

export const THEME_REGISTRY: Record<IconThemeId, IconTheme> = {
  lucide: lucideTheme,
  codicons: codiconsTheme,
  symbols: symbolsTheme,
  'one-dark': oneDarkTheme,
  material: materialTheme,
  catppuccin: catppuccinTheme,
  seti: setiTheme,
};

export const ICON_THEMES: IconTheme[] = [
  lucideTheme,
  codiconsTheme,
  symbolsTheme,
  oneDarkTheme,
  materialTheme,
  catppuccinTheme,
  setiTheme,
];
