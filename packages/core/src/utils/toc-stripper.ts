/**
 * TOC Stripper
 * Detects and removes Table of Contents sections from markdown
 */

export interface TocStripResult {
  markdown: string;
  tocFound: boolean;
  tocRange?: { start: number; end: number };
}

/**
 * Optional logger interface for debug output.
 * When not provided, logging is silently skipped.
 */
export interface TocStripperLogger {
  debug(context: string, ...args: unknown[]): void;
  info(context: string, ...args: unknown[]): void;
}

const noopLogger: TocStripperLogger = {
  debug: () => {},
  info: () => {},
};

/**
 * Strip Table of Contents sections from markdown when custom TOC is enabled
 * Detects common TOC patterns:
 * - Headings like "Table of Contents", "Contents", "TOC"
 * - Followed by list items with anchor links
 *
 * @param markdown - The markdown content to strip TOC from
 * @param logger - Optional logger for debug output (defaults to no-op)
 */
export function stripTableOfContents(
  markdown: string,
  logger: TocStripperLogger = noopLogger
): TocStripResult {
  const lines = markdown.split('\n');
  const tocRanges: Array<{ start: number; end: number }> = [];

  // Pattern to match TOC headings (case-insensitive)
  const tocHeadingPattern = /^#{1,6}\s+(table of contents|contents|toc)\s*$/i;

  // Pattern to match list items (with or without anchor links)
  const listItemPattern = /^\s*[-*+]\s+/;
  const orderedListPattern = /^\s*\d+\.\s+/;
  const anchorLinkPattern = /\[.*?\]\(#.*?\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a TOC heading
    if (tocHeadingPattern.test(line.trim())) {
      logger.debug('TocStripper', `Found TOC heading at line ${i}: "${line}"`);

      const tocStart = i;
      let tocEnd = i;
      let anchorLinkCount = 0;
      let consecutiveNonListLines = 0;

      // Scan forward to find the extent of the TOC
      for (let j = i + 1; j < lines.length; j++) {
        const currentLine = lines[j];
        const trimmedLine = currentLine.trim();

        // Stop at the next heading
        if (/^#{1,6}\s+/.test(trimmedLine)) {
          logger.debug('TocStripper', `TOC ends at line ${j - 1} (next heading found)`);
          break;
        }

        // Check if this is a list item
        const isListItem =
          listItemPattern.test(currentLine) || orderedListPattern.test(currentLine);

        if (isListItem) {
          tocEnd = j;
          consecutiveNonListLines = 0;

          // Count anchor links to confirm this is a TOC
          if (anchorLinkPattern.test(currentLine)) {
            anchorLinkCount++;
          }
        } else if (trimmedLine === '') {
          // Empty lines are okay within TOC, but track consecutive ones
          consecutiveNonListLines++;

          // If we have multiple consecutive blank lines, stop
          if (consecutiveNonListLines > 2) {
            logger.debug(
              'TocStripper',
              `TOC ends at line ${tocEnd} (multiple blank lines after list)`
            );
            break;
          }
        } else {
          // Non-list, non-empty line - TOC has ended
          logger.debug('TocStripper', `TOC ends at line ${tocEnd} (non-list content found)`);
          break;
        }
      }

      // Only consider it a TOC if we found list items with anchor links
      // OR if we found ordered/unordered lists right after the heading
      const hasListItems = tocEnd > tocStart;
      const likelyToc = anchorLinkCount >= 2 || (hasListItems && anchorLinkCount >= 1);

      if (likelyToc) {
        logger.info(
          'TocStripper',
          `Confirmed TOC from line ${tocStart} to ${tocEnd} (${anchorLinkCount} anchor links)`
        );
        tocRanges.push({ start: tocStart, end: tocEnd });
        // Skip ahead to avoid re-processing
        i = tocEnd;
      } else {
        logger.debug(
          'TocStripper',
          `Skipping potential TOC at line ${tocStart} (insufficient anchor links: ${anchorLinkCount})`
        );
      }
    }
  }

  // If no TOC found, return original markdown
  if (tocRanges.length === 0) {
    logger.debug('TocStripper', 'No TOC found in markdown');
    return {
      markdown,
      tocFound: false,
    };
  }

  // Remove TOC ranges (in reverse order to preserve line numbers)
  const strippedLines = [...lines];
  for (let i = tocRanges.length - 1; i >= 0; i--) {
    const range = tocRanges[i];
    // Remove lines from start to end (inclusive)
    strippedLines.splice(range.start, range.end - range.start + 1);

    // Clean up excess blank lines after removal
    // Remove consecutive blank lines at the splice point
    while (
      range.start < strippedLines.length &&
      range.start > 0 &&
      strippedLines[range.start]?.trim() === '' &&
      strippedLines[range.start - 1]?.trim() === ''
    ) {
      strippedLines.splice(range.start, 1);
    }
  }

  const strippedMarkdown = strippedLines.join('\n');

  logger.info('TocStripper', `Stripped ${tocRanges.length} TOC section(s) from markdown`);

  return {
    markdown: strippedMarkdown,
    tocFound: true,
    tocRange: tocRanges[0], // Return first TOC range for reference
  };
}
