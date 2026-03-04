/**
 * Source Position Map for Comment Anchoring
 *
 * Strips markdown inline formatting from source while maintaining a parallel
 * array mapping each plain-text character back to its source offset. This gives
 * exact insertion points for comment footnote references without needing
 * markdown-it's inline token positions.
 */

export interface SourcePositionMap {
  rawSource: string;
  plainText: string;
  offsets: number[];
  spans: FormattingSpan[];
}

export interface FormattingSpan {
  sourceStart: number;
  sourceEnd: number;
  plainStart: number;
  plainEnd: number;
  type: 'bold' | 'italic' | 'strikethrough' | 'code' | 'link' | 'image' | 'escape';
}

export interface SelectionContext {
  prefix: string;
  suffix: string;
}

const COMMENT_SEPARATOR = '<!-- mdview:comments -->';

/**
 * Build a source position map from raw markdown.
 * Processes only the content section (above `<!-- mdview:comments -->`).
 */
export function buildSourceMap(rawMarkdown: string): SourcePositionMap {
  const sepIdx = rawMarkdown.indexOf(COMMENT_SEPARATOR);
  const rawSource = sepIdx === -1 ? rawMarkdown : rawMarkdown.slice(0, sepIdx);

  const result = buildSourceMapRange(rawSource, 0, rawSource.length, 0);

  return {
    rawSource,
    plainText: result.chars.join(''),
    offsets: result.offsets,
    spans: result.spans,
  };
}

/**
 * Find the correct insertion point in the raw source for a comment reference.
 */
export function findInsertionPoint(
  map: SourcePositionMap,
  selectedText: string,
  context?: SelectionContext
): number | null {
  if (!selectedText) return null;

  // Find all occurrences of selectedText in plainText
  const matches: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = map.plainText.indexOf(selectedText, searchFrom);
    if (idx === -1) break;
    matches.push(idx);
    searchFrom = idx + 1;
  }

  if (matches.length === 0) return null;

  let bestMatch = matches[0];

  // Disambiguate using context if multiple matches and context provided
  if (matches.length > 1 && context) {
    let bestScore = -1;
    for (const matchIdx of matches) {
      let score = 0;
      // Score by prefix match
      if (context.prefix) {
        const plainBefore = map.plainText.slice(
          Math.max(0, matchIdx - context.prefix.length),
          matchIdx
        );
        score += commonSuffixLength(context.prefix, plainBefore);
      }
      // Score by suffix match
      if (context.suffix) {
        const plainAfter = map.plainText.slice(
          matchIdx + selectedText.length,
          matchIdx + selectedText.length + context.suffix.length
        );
        score += commonPrefixLength(context.suffix, plainAfter);
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = matchIdx;
      }
    }
  }

  // Map the match end position back to source
  const plainEndIdx = bestMatch + selectedText.length - 1;
  if (plainEndIdx >= map.offsets.length) return null;

  const sourcePos = map.offsets[plainEndIdx] + 1;

  // Check if the position falls inside any formatting spans.
  // Use the outermost span's sourceEnd to avoid inserting inside nested constructs.
  let insertAt = sourcePos;
  for (const span of map.spans) {
    if (
      bestMatch >= span.plainStart &&
      bestMatch + selectedText.length <= span.plainEnd &&
      span.type !== 'escape' &&
      sourcePos < span.sourceEnd
    ) {
      insertAt = Math.max(insertAt, span.sourceEnd);
    }
  }

  return insertAt;
}

// ─── Internal helpers ────────────────────────────────────────────────

function isEscapable(ch: string): boolean {
  return '\\`*_{}[]()#+-.!~>|'.includes(ch);
}

interface ParseResult {
  span: FormattingSpan;
  text: string;
  contentStart: number;
  contentEnd: number;
}

function parseInlineCode(src: string, start: number, plainPos: number): ParseResult | null {
  // Count opening backticks
  let ticks = 0;
  let i = start;
  while (i < src.length && src[i] === '`') {
    ticks++;
    i++;
  }

  // Find matching closing backticks
  const closer = '`'.repeat(ticks);
  const closeIdx = src.indexOf(closer, i);
  if (closeIdx === -1) return null;

  // Verify exact match (no extra backticks)
  if (closeIdx + ticks < src.length && src[closeIdx + ticks] === '`') return null;

  const contentStart = i;
  const contentEnd = closeIdx;
  const content = src.slice(contentStart, contentEnd);

  return {
    span: {
      sourceStart: start,
      sourceEnd: closeIdx + ticks,
      plainStart: plainPos,
      plainEnd: plainPos + content.length,
      type: 'code',
    },
    text: content,
    contentStart,
    contentEnd,
  };
}

function parseLinkOrImage(
  src: string,
  start: number,
  plainPos: number,
  isImage: boolean
): ParseResult | null {
  const bracketStart = isImage ? start + 2 : start + 1; // skip `![` or `[`
  let depth = 1;
  let i = bracketStart;

  // Find the matching `]`
  while (i < src.length && depth > 0) {
    if (src[i] === '\\' && i + 1 < src.length) {
      i += 2;
      continue;
    }
    if (src[i] === '[') depth++;
    if (src[i] === ']') depth--;
    if (depth > 0) i++;
  }

  if (depth !== 0) return null;
  const bracketEnd = i; // position of `]`

  // Expect `(` immediately after `]`
  if (bracketEnd + 1 >= src.length || src[bracketEnd + 1] !== '(') return null;

  // Find matching `)`
  let parenDepth = 1;
  let j = bracketEnd + 2;
  while (j < src.length && parenDepth > 0) {
    if (src[j] === '\\' && j + 1 < src.length) {
      j += 2;
      continue;
    }
    if (src[j] === '(') parenDepth++;
    if (src[j] === ')') parenDepth--;
    if (parenDepth > 0) j++;
  }

  if (parenDepth !== 0) return null;

  return {
    span: {
      sourceStart: start,
      sourceEnd: j + 1, // after `)`
      plainStart: plainPos,
      plainEnd: plainPos, // will be updated by caller
      type: isImage ? 'image' : 'link',
    },
    text: src.slice(bracketStart, bracketEnd),
    contentStart: bracketStart,
    contentEnd: bracketEnd,
  };
}

interface DelimitedResult {
  span: FormattingSpan;
  contentStart: number;
  contentEnd: number;
}

function parseDelimited(
  src: string,
  start: number,
  marker: string,
  plainPos: number,
  type: FormattingSpan['type'],
  searchEnd: number = src.length
): DelimitedResult | null {
  const mLen = marker.length;
  const contentStart = start + mLen;

  // Don't match if there's a space right after the opening marker
  if (contentStart >= searchEnd || src[contentStart] === ' ') return null;

  // Find the closing marker (not preceded by space, not escaped)
  let i = contentStart;
  while (i < searchEnd) {
    if (src[i] === '\\' && i + 1 < searchEnd) {
      i += 2;
      continue;
    }
    if (src.startsWith(marker, i) && src[i - 1] !== ' ') {
      // For ** or __, make sure we don't match a longer run
      if (mLen === 2) {
        // Make sure we don't have a third marker char within search range
        if (i + mLen < searchEnd && src[i + mLen] === marker[0]) {
          i++;
          continue;
        }
      }
      if (mLen === 1) {
        // For single marker, make sure there's no second marker char within search range
        if (i + 1 < searchEnd && src[i + 1] === marker[0]) {
          i++;
          continue;
        }
      }
      return {
        span: {
          sourceStart: start,
          sourceEnd: i + mLen,
          plainStart: plainPos,
          plainEnd: plainPos, // will be updated
          type,
        },
        contentStart,
        contentEnd: i,
      };
    }
    i++;
  }

  return null;
}

function buildSourceMapRange(
  src: string,
  start: number,
  end: number,
  basePlainPos: number
): { chars: string[]; offsets: number[]; spans: FormattingSpan[] } {
  const chars: string[] = [];
  const offsets: number[] = [];
  const spans: FormattingSpan[] = [];
  let i = start;

  while (i < end) {
    // Escape sequences
    if (src[i] === '\\' && i + 1 < end && isEscapable(src[i + 1])) {
      const plainPos = basePlainPos + chars.length;
      spans.push({
        sourceStart: i,
        sourceEnd: i + 2,
        plainStart: plainPos,
        plainEnd: plainPos + 1,
        type: 'escape',
      });
      chars.push(src[i + 1]);
      offsets.push(i + 1);
      i += 2;
      continue;
    }

    // Inline code
    if (src[i] === '`') {
      const plainPos = basePlainPos + chars.length;
      const result = parseInlineCode(src, i, plainPos);
      if (result && result.span.sourceEnd <= end) {
        spans.push(result.span);
        for (let j = 0; j < result.text.length; j++) {
          chars.push(result.text[j]);
          offsets.push(result.contentStart + j);
        }
        i = result.span.sourceEnd;
        continue;
      }
    }

    // Images
    if (src[i] === '!' && i + 1 < end && src[i + 1] === '[') {
      const plainPos = basePlainPos + chars.length;
      const result = parseLinkOrImage(src, i, plainPos, true);
      if (result && result.span.sourceEnd <= end) {
        spans.push(result.span);
        const inner = buildSourceMapRange(src, result.contentStart, result.contentEnd, basePlainPos + chars.length);
        for (const ch of inner.chars) chars.push(ch);
        for (const off of inner.offsets) offsets.push(off);
        for (const sp of inner.spans) spans.push(sp);
        result.span.plainEnd = basePlainPos + chars.length;
        i = result.span.sourceEnd;
        continue;
      }
    }

    // Links
    if (src[i] === '[') {
      const plainPos = basePlainPos + chars.length;
      const result = parseLinkOrImage(src, i, plainPos, false);
      if (result && result.span.sourceEnd <= end) {
        spans.push(result.span);
        const inner = buildSourceMapRange(src, result.contentStart, result.contentEnd, basePlainPos + chars.length);
        for (const ch of inner.chars) chars.push(ch);
        for (const off of inner.offsets) offsets.push(off);
        for (const sp of inner.spans) spans.push(sp);
        result.span.plainEnd = basePlainPos + chars.length;
        i = result.span.sourceEnd;
        continue;
      }
    }

    // Bold
    if (
      (src[i] === '*' && i + 1 < end && src[i + 1] === '*') ||
      (src[i] === '_' && i + 1 < end && src[i + 1] === '_')
    ) {
      const marker = src.slice(i, i + 2);
      const plainPos = basePlainPos + chars.length;
      const result = parseDelimited(src, i, marker, plainPos, 'bold', end);
      if (result && result.span.sourceEnd <= end) {
        spans.push(result.span);
        const inner = buildSourceMapRange(src, result.contentStart, result.contentEnd, basePlainPos + chars.length);
        for (const ch of inner.chars) chars.push(ch);
        for (const off of inner.offsets) offsets.push(off);
        for (const sp of inner.spans) spans.push(sp);
        result.span.plainEnd = basePlainPos + chars.length;
        i = result.span.sourceEnd;
        continue;
      }
    }

    // Strikethrough
    if (src[i] === '~' && i + 1 < end && src[i + 1] === '~') {
      const plainPos = basePlainPos + chars.length;
      const result = parseDelimited(src, i, '~~', plainPos, 'strikethrough', end);
      if (result && result.span.sourceEnd <= end) {
        spans.push(result.span);
        const inner = buildSourceMapRange(src, result.contentStart, result.contentEnd, basePlainPos + chars.length);
        for (const ch of inner.chars) chars.push(ch);
        for (const off of inner.offsets) offsets.push(off);
        for (const sp of inner.spans) spans.push(sp);
        result.span.plainEnd = basePlainPos + chars.length;
        i = result.span.sourceEnd;
        continue;
      }
    }

    // Italic (single marker)
    if (src[i] === '*' || src[i] === '_') {
      const marker = src[i];
      const plainPos = basePlainPos + chars.length;
      const result = parseDelimited(src, i, marker, plainPos, 'italic', end);
      if (result && result.span.sourceEnd <= end) {
        spans.push(result.span);
        const inner = buildSourceMapRange(src, result.contentStart, result.contentEnd, basePlainPos + chars.length);
        for (const ch of inner.chars) chars.push(ch);
        for (const off of inner.offsets) offsets.push(off);
        for (const sp of inner.spans) spans.push(sp);
        result.span.plainEnd = basePlainPos + chars.length;
        i = result.span.sourceEnd;
        continue;
      }
    }

    // Plain character
    chars.push(src[i]);
    offsets.push(i);
    i++;
  }

  return { chars, offsets, spans };
}

function commonSuffixLength(a: string, b: string): number {
  let count = 0;
  let ai = a.length - 1;
  let bi = b.length - 1;
  while (ai >= 0 && bi >= 0 && a[ai] === b[bi]) {
    count++;
    ai--;
    bi--;
  }
  return count;
}

function commonPrefixLength(a: string, b: string): number {
  let count = 0;
  const limit = Math.min(a.length, b.length);
  while (count < limit && a[count] === b[count]) {
    count++;
  }
  return count;
}
