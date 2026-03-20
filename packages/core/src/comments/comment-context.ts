/**
 * Comment Context Builder
 *
 * Computes positional context (line number, section heading, breadcrumb)
 * for a comment at a given character offset in markdown content. This
 * metadata is stored in the footnote definition so AI agents reading
 * the raw file can immediately understand where each comment is anchored.
 */

import type { CommentContext } from '../types/index';
import { splitIntoSections, type MarkdownSection } from '../utils/section-splitter';

/**
 * Compute positional context for a comment at a given character offset
 * in the content section of markdown (above the comment separator).
 */
export function computeCommentContext(contentMarkdown: string, charOffset: number): CommentContext {
  const line = offsetToLine(contentMarkdown, charOffset);
  const sections = splitIntoSections(contentMarkdown);
  const { section, sectionLevel, breadcrumb } = findSectionContext(sections, line);

  return {
    line,
    section,
    sectionLevel,
    breadcrumb,
  };
}

/**
 * Convert a 0-based character offset to a 1-based line number.
 */
function offsetToLine(text: string, offset: number): number {
  const clamped = Math.min(offset, text.length);
  let line = 1;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === '\n') {
      line++;
    }
  }
  return line;
}

/**
 * Given sections from splitIntoSections() and a 1-based line number,
 * find the containing section and build the heading breadcrumb.
 */
function findSectionContext(
  sections: MarkdownSection[],
  line: number
): { section?: string; sectionLevel?: number; breadcrumb: string[] } {
  // splitIntoSections uses 0-based line indices; our line is 1-based
  const zeroLine = line - 1;

  let containingSection: MarkdownSection | undefined;
  for (const s of sections) {
    if (zeroLine >= s.startLine && zeroLine <= s.endLine) {
      containingSection = s;
      break;
    }
  }

  if (!containingSection || !containingSection.heading) {
    return { breadcrumb: [] };
  }

  const breadcrumb = buildBreadcrumb(sections, containingSection);

  return {
    section: containingSection.heading,
    sectionLevel: containingSection.level,
    breadcrumb,
  };
}

/**
 * Build a heading breadcrumb from the document start to the target section.
 *
 * Walk all sections up to and including the target. Maintain a stack:
 * when encountering a heading at level N, pop all headings at level >= N,
 * then push. The final stack is the breadcrumb.
 */
function buildBreadcrumb(sections: MarkdownSection[], target: MarkdownSection): string[] {
  const stack: Array<{ heading: string; level: number }> = [];

  for (const s of sections) {
    if (s.heading && s.level !== undefined) {
      // Pop headings at same or deeper level
      while (stack.length > 0 && stack[stack.length - 1].level >= s.level) {
        stack.pop();
      }
      stack.push({ heading: s.heading, level: s.level });
    }

    if (s === target) {
      break;
    }
  }

  return stack.map((entry) => entry.heading);
}
