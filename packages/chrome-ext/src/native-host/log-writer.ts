/**
 * Self-contained log writer for the native messaging host.
 *
 * The native host is bundled as a single CJS file (host.cjs) and is launched
 * by Chrome with a synchronous request/response shape. We deliberately do not
 * import `@mdreview/core` here so the host stays minimal and avoids pulling
 * the renderer-side dependency graph into the host bundle.
 *
 * The rotation and prune logic mirrors the pure helpers in
 * `@mdreview/core/logging` (`currentFileName`, `planRotation`, `planPrune`),
 * inlined so this file is independent.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'chrome';
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 14;
const MS_PER_DAY = 86_400_000;

export interface WriteLogBatchOpts {
  /** Target log directory. Created recursively if missing. */
  dir: string;
  /** Date used for the file stem. Tests inject a fixed Date. */
  today?: Date;
  /** Maximum bytes per file before size rollover. Defaults to 10 MB. */
  maxBytes?: number;
  /** Retain files newer than this many days. Defaults to 14. */
  retentionDays?: number;
}

function dateStem(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function currentFileName(today: Date): string {
  return `mdview-${SOURCE}-${dateStem(today)}.jsonl`;
}

const SOURCE_REGEX = new RegExp(`^mdview-${SOURCE}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl(?:\\.\\d+)?$`);

function nextSizeSuffix(names: readonly string[], baseName: string): number {
  const prefix = `${baseName}.`;
  const used = new Set<number>();
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const tail = name.slice(prefix.length);
    if (!/^\d+$/.test(tail)) continue;
    const n = Number.parseInt(tail, 10);
    if (n > 0) used.add(n);
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

function pickPruneTargets(names: readonly string[], today: Date, retentionDays: number): string[] {
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const cutoffMs = todayMs - retentionDays * MS_PER_DAY;
  const out: string[] = [];
  for (const name of names) {
    const match = SOURCE_REGEX.exec(name);
    if (!match) continue;
    const [y, m, day] = match[1].split('-').map((s) => Number.parseInt(s, 10));
    const entryMs = Date.UTC(y, m - 1, day);
    if (entryMs < cutoffMs) out.push(name);
  }
  return out;
}

/**
 * Append a batch of records as JSONL to the current dated log file, applying
 * date and size rotation and pruning files older than the retention window.
 *
 * All I/O is synchronous because the native host is a single-shot stdin/stdout
 * request/response handler with no async event loop expectation.
 */
export function writeLogBatch(records: ReadonlyArray<unknown>, opts: WriteLogBatchOpts): void {
  const today = opts.today ?? new Date();
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const retentionDays = opts.retentionDays ?? DEFAULT_RETENTION_DAYS;

  // Empty batches are a valid no-op; skip directory creation and I/O so the
  // host can ack quickly without touching the filesystem.
  if (records.length === 0) return;

  if (!existsSync(opts.dir)) {
    mkdirSync(opts.dir, { recursive: true });
  }

  const target = currentFileName(today);
  const targetPath = join(opts.dir, target);
  const payload = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const pendingBytes = Buffer.byteLength(payload, 'utf8');

  const names = readdirSync(opts.dir);

  // Size rotation: if the current file would overflow, rename it to
  // <name>.<suffix> and create a fresh file.
  if (names.includes(target)) {
    let currentBytes = 0;
    try {
      currentBytes = statSync(targetPath).size;
    } catch {
      currentBytes = 0;
    }
    if (currentBytes + pendingBytes > maxBytes) {
      const suffix = nextSizeSuffix(names, target);
      renameSync(targetPath, `${targetPath}.${suffix}`);
    }
  }

  appendFileSync(targetPath, payload, 'utf8');

  // Touch the file via writeFileSync if append did not (in practice
  // appendFileSync creates the file; this guard is defensive).
  if (!existsSync(targetPath)) {
    writeFileSync(targetPath, payload, 'utf8');
  }

  // Prune: drop files older than retentionDays. Refresh the directory listing
  // so we see any freshly-renamed siblings.
  const refreshed = readdirSync(opts.dir);
  const toPrune = pickPruneTargets(refreshed, today, retentionDays);
  for (const name of toPrune) {
    try {
      unlinkSync(join(opts.dir, name));
    } catch {
      // Best-effort prune; swallow filesystem errors.
    }
  }
}
