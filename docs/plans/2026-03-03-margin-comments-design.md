# Margin Comments for mdview

## Overview

A comment system that lets users annotate local markdown files viewed in mdview.
Comments appear as styled cards in the right margin with associated text highlighted,
and persist as structured footnotes in the markdown source. Designed for reviewers
leaving feedback for agentic or human collaborators.

## User Experience

### Creating a Comment

1. User selects text in the rendered markdown
2. Right-clicks, selects "Add Comment" from context menu
3. A comment card appears in the right margin aligned with the selection
4. User types their comment, clicks Save (or Cmd+Enter)
5. Selected text is highlighted, footnote reference and body are written to the `.md` file
6. A subtle toast confirms the save

### Viewing Comments

- Cards appear in the right margin, visually connected to highlighted text
- Clicking a highlight scrolls/focuses the corresponding card
- Clicking a card scrolls the highlighted text into view
- Resolved comments appear dimmed with strikethrough, collapsed by default

### Comment Lifecycle

Each card has a `...` overflow menu with:

- **Edit** - Opens card in edit mode with existing text
- **Resolve** - Dims the card, adds `"resolved": true` to metadata
- **Delete** - Removes both the footnote reference and body from the file

## File Format

Comments are stored as footnotes with structured metadata in an HTML comment:

```markdown
# Document Title

Regular content here with a comment[^comment-1] on this phrase.

More content with another[^comment-2] note.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->
    Needs clarification on the scope here.

[^comment-2]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:35:00Z","resolved":true} -->
    Addressed in revision 2.
```

### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `author` | string | yes | From extension settings |
| `date` | string | yes | ISO 8601 timestamp |
| `resolved` | boolean | no | Present and `true` when resolved |

### Comment ID Scheme

- IDs follow the pattern `comment-N` where N is an incrementing integer
- On creation, scan existing `[^comment-*]` references to find the next available number

### Reference Placement

- `[^comment-N]` is inserted immediately after the last word of the selected text
- Footnote bodies are appended after a `<!-- mdview:comments -->` separator at the end of the file

### Text-to-Source Mapping

The selected rendered text is used as a search string in the raw markdown source.
For ambiguous matches (same text appears multiple times), surrounding context
(preceding/following text) is used to disambiguate.

## Visual Design

### Comment Cards

- Positioned absolutely in the right margin, anchored to their highlight's vertical position
- Subtle background (`--md-code-bg`), thin left border in accent color (`--md-link`), rounded corners, soft shadow
- Author name bold, relative timestamp muted
- Body text with ~3 line truncation and "show more"
- Resolved: reduced opacity, strikethrough, "resolved" badge
- Cards stack vertically when clustered, with connecting lines to highlights

### Text Highlighting

- Semi-transparent background on commented text
- Light themes: warm yellow highlight
- Dark themes: muted amber/gold
- Resolved highlights use a dimmer variant
- Hover on card brightens its highlight and vice versa

### Layout

| Mode | No Comments | Comments Active |
|------|-------------|-----------------|
| Normal (980px max) | Centered | Shifts left, 280px right gutter |
| Full-width | 100% viewport | `calc(100% - 280px)` content, 280px right gutter |
| Narrow (<1024px) | Centered | No gutter; icons in margin, popover on click |

## Architecture

### New Source Files

```
src/
├── comments/
│   ├── comment-manager.ts      # CRUD orchestrator, file I/O via native host
│   ├── comment-parser.ts       # Parse mdview:comment footnotes from raw markdown
│   ├── comment-serializer.ts   # Generate footnote text, inject/remove from source
│   ├── comment-ui.ts           # Margin cards, context menu, input form
│   └── comment-highlight.ts    # Text highlighting, hover cross-referencing
src/native-host/
├── host.js                     # Node.js native messaging host script
├── manifest.json               # Chrome native messaging manifest
└── install.sh                  # One-line installer script
```

### Render Pipeline Integration

The comment system hooks into the existing pipeline at two points:

1. **Pre-parse (before Stage 1):** `comment-parser` strips `[^comment-*]` footnotes and
   their bodies from the raw markdown, storing them as structured `Comment` objects.
   The cleaned markdown passes through the normal pipeline. This sidesteps the
   `markdown-it-footnote` ESM issue entirely.

2. **Post-enhance (after Stage 5):** `comment-ui` locates the commented text in the
   rendered DOM, wraps it in highlight spans, and renders margin cards. Runs alongside
   existing enhancement steps (copy buttons, lazy loading, etc).

### Native Messaging Host

A small Node.js script registered with Chrome for file write access:

- Receives `{action, path, content}` messages via stdin
- Validates path is a `.md`/`.markdown` file
- Writes file contents and returns success/error via stdout
- Only the mdview extension (by ID) can communicate with the host

**Installation:**
```bash
npx mdview-host install
```
Copies the host script and registers the manifest at
`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`.

### Write-Reload Cycle

When a comment is saved:

1. `comment-serializer` builds the updated markdown string
2. `comment-manager` sends write message to native host
3. Native host writes the file
4. Auto-reload guard flag is set to suppress the next reload
5. DOM is patched optimistically (highlight + card inserted directly)
6. Guard clears; next external file change triggers normal re-render

**State preserved across reload:**
- Scroll position (existing `scroll-manager.ts`)
- Active/focused comment card ID
- In-progress edit drafts (deferred reload or draft preservation)

### Theme Integration

Three new CSS variables per theme:

| Variable | Purpose |
|----------|---------|
| `--md-comment-highlight` | Text highlight background |
| `--md-comment-highlight-resolved` | Dimmer variant for resolved comments |
| `--md-comment-card-bg` | Card background (defaults to `--md-code-bg`) |

### Settings Additions

- **Options page (Appearance tab):** "Author name" text field
- **Popup:** "Comments" toggle to enable/disable the feature

## Scope Boundaries

**In scope:**
- Single-user local file commenting
- CRUD + resolve lifecycle
- Footnote persistence format
- Native messaging host for file writes
- Theme-aware highlighting and cards
- All layout modes (normal, full-width, narrow)

**Not in scope:**
- Multi-user real-time collaboration
- Comment threading or replies
- Remote file commenting
- Inline editing (always uses card UI)

## Testing Strategy

### Unit Tests

- `comment-parser.test.ts` - Parse footnotes, extract metadata, handle malformed input,
  distinguish mdview comments from regular footnotes
- `comment-serializer.test.ts` - Inject references at correct positions, append bodies
  with separator, remove on delete, update metadata on resolve, handle edge cases
  (duplicate text, multi-line selection, start/end of file)
- `comment-manager.test.ts` - CRUD orchestration, ID generation, auto-reload guard,
  optimistic DOM patching
- `comment-highlight.test.ts` - Highlight wrappers, hover cross-referencing, theme
  variables, resolved dimming
- `comment-ui.test.ts` - Card rendering, overflow menu, positioning, stacking,
  input form, narrow viewport collapse

### Integration Tests

- Round-trip: raw markdown with comments -> parse -> render -> cards + highlights
- Write cycle: create -> serialize -> verify output markdown
- Edit cycle: modify -> re-serialize -> verify only target changed
- Resolve cycle: resolve -> verify metadata flag, highlight dimmed
- Delete cycle: delete -> verify reference and body removed

### Native Host Tests

- Message protocol: valid write -> success response
- Path validation: reject non-markdown paths
- Error handling: permission denied, file not found
