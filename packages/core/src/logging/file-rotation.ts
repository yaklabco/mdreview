export type LogSource = 'electron' | 'chrome' | 'native-host';

export interface DirEntry {
  name: string;
  size: number;
}

export interface RotationOpts {
  source: LogSource;
  today: Date;
  maxBytes: number;
  retentionDays: number;
}

export type RotationAction =
  | { kind: 'append'; file: string }
  | { kind: 'rollover-date'; from: string; to: string }
  | { kind: 'rollover-size'; from: string; renameTo: string; to: string };

const MS_PER_DAY = 86_400_000;

// Returns the YYYY-MM-DD date stem in UTC, keeping tests timezone-independent.
export function dateStem(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function currentFileName(source: LogSource, today: Date): string {
  return `mdview-${source}-${dateStem(today)}.jsonl`;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceFilenameRegex(source: LogSource): RegExp {
  return new RegExp(`^mdview-${escapeRegExp(source)}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl(?:\\.\\d+)?$`);
}

export function nextSizeSuffix(dir: readonly DirEntry[], baseName: string): number {
  const prefix = `${baseName}.`;
  const used = new Set<number>();
  for (const entry of dir) {
    if (!entry.name.startsWith(prefix)) continue;
    const tail = entry.name.slice(prefix.length);
    if (!/^\d+$/.test(tail)) continue;
    const n = Number.parseInt(tail, 10);
    if (n > 0) used.add(n);
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

export function planRotation(
  dir: readonly DirEntry[],
  currentFile: string | null,
  currentBytes: number,
  pendingBytes: number,
  opts: RotationOpts
): RotationAction {
  const target = currentFileName(opts.source, opts.today);

  if (currentFile === null) {
    return { kind: 'append', file: target };
  }

  if (currentFile !== target) {
    return { kind: 'rollover-date', from: currentFile, to: target };
  }

  if (currentBytes + pendingBytes > opts.maxBytes) {
    const suffix = nextSizeSuffix(dir, currentFile);
    return {
      kind: 'rollover-size',
      from: currentFile,
      renameTo: `${currentFile}.${suffix}`,
      to: currentFile,
    };
  }

  return { kind: 'append', file: currentFile };
}

export function planPrune(
  dir: readonly DirEntry[],
  opts: { today: Date; retentionDays: number; source: LogSource }
): string[] {
  const re = sourceFilenameRegex(opts.source);
  const todayMs = Date.UTC(
    opts.today.getUTCFullYear(),
    opts.today.getUTCMonth(),
    opts.today.getUTCDate()
  );
  const cutoffMs = todayMs - opts.retentionDays * MS_PER_DAY;

  const out: string[] = [];
  for (const entry of dir) {
    const match = re.exec(entry.name);
    if (!match) continue;
    const stem = match[1];
    const [y, m, day] = stem.split('-').map((s) => Number.parseInt(s, 10));
    const entryMs = Date.UTC(y, m - 1, day);
    if (entryMs < cutoffMs) {
      out.push(entry.name);
    }
  }
  return out;
}
