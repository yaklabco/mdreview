/**
 * Frontmatter Extractor
 * Extracts YAML frontmatter from markdown and renders it as an HTML card
 */

export interface FrontmatterResult {
  cleanedMarkdown: string;
  frontmatter: Record<string, string> | null;
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Extract YAML frontmatter from the beginning of a markdown string.
 * Returns the cleaned markdown (frontmatter stripped) and parsed key-value pairs.
 */
export function extractFrontmatter(markdown: string): FrontmatterResult {
  if (!markdown) {
    return { cleanedMarkdown: '', frontmatter: null };
  }

  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    return { cleanedMarkdown: markdown, frontmatter: null };
  }

  const rawBlock = match[1];
  const frontmatter: Record<string, string> = {};

  for (const line of rawBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    if (!key) continue;

    let value = line.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  const cleanedMarkdown = markdown.slice(match[0].length);

  return {
    cleanedMarkdown,
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null,
  };
}

/**
 * Render frontmatter data as a collapsible HTML details card.
 */
export function renderFrontmatterHtml(frontmatter: Record<string, string>): string {
  const rows = Object.entries(frontmatter)
    .map(
      ([key, value]) =>
        `<tr><td class="frontmatter-key">${escapeHtml(key)}</td><td class="frontmatter-value">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  return `<details class="frontmatter-card"><summary>Frontmatter</summary><table>${rows}</table></details>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
