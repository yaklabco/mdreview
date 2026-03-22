import type { Theme } from '../types/index';

import catppuccinFrappe from '../themes/catppuccin-frappe';
import catppuccinLatte from '../themes/catppuccin-latte';
import catppuccinMacchiato from '../themes/catppuccin-macchiato';
import catppuccinMocha from '../themes/catppuccin-mocha';
import githubDark from '../themes/github-dark';
import githubLight from '../themes/github-light';
import monokaiPro from '../themes/monokai-pro';
import monokai from '../themes/monokai';
import oneDarkPro from '../themes/one-dark-pro';

const requiredFields: (keyof Theme)[] = [
  'name',
  'displayName',
  'variant',
  'colors',
  'typography',
  'spacing',
  'syntaxTheme',
  'mermaidTheme',
];

const themes: { label: string; theme: Theme }[] = [
  { label: 'catppuccin-frappe', theme: catppuccinFrappe },
  { label: 'catppuccin-latte', theme: catppuccinLatte },
  { label: 'catppuccin-macchiato', theme: catppuccinMacchiato },
  { label: 'catppuccin-mocha', theme: catppuccinMocha },
  { label: 'github-dark', theme: githubDark },
  { label: 'github-light', theme: githubLight },
  { label: 'monokai-pro', theme: monokaiPro },
  { label: 'monokai', theme: monokai },
  { label: 'one-dark-pro', theme: oneDarkPro },
];

describe('@mdreview/core themes', () => {
  it.each(themes)('$label has all required Theme fields', ({ theme }) => {
    for (const field of requiredFields) {
      expect(theme).toHaveProperty(field);
      expect(theme[field]).toBeDefined();
    }
  });

  it.each(themes)('$label has a valid variant', ({ theme }) => {
    expect(['light', 'dark']).toContain(theme.variant);
  });

  it.each(themes)('$label has name matching its label', ({ label, theme }) => {
    expect(theme.name).toBe(label);
  });

  it.each(themes)('$label has non-empty displayName', ({ theme }) => {
    expect(theme.displayName.length).toBeGreaterThan(0);
  });

  it.each(themes)('$label has valid mermaidTheme', ({ theme }) => {
    expect(theme.mermaidTheme).toHaveProperty('theme');
    expect(theme.mermaidTheme).toHaveProperty('themeVariables');
    expect(theme.mermaidTheme.themeVariables).toHaveProperty('primaryColor');
    expect(theme.mermaidTheme.themeVariables).toHaveProperty('primaryTextColor');
  });
});
