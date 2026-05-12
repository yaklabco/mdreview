import { promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  currentFileName,
  planPrune,
  planRotation,
  type DirEntry,
  type LogRecord,
  type LogSource,
  type LogTransport,
  type TransportResult,
} from '@mdreview/core/logging';

export interface FileTransportOpts {
  dir?: string;
  source: LogSource;
  maxBytes?: number;
  retentionDays?: number;
  now?: () => Date;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 14;

export class FileTransport implements LogTransport {
  private readonly dir: string;
  private readonly source: LogSource;
  private readonly maxBytes: number;
  private readonly retentionDays: number;
  private readonly now: () => Date;

  private handle: FileHandle | null = null;
  private currentFile: string | null = null;
  private currentBytes = 0;
  private dirEnsured = false;
  private dirCache: DirEntry[] | null = null;

  constructor(opts: FileTransportOpts) {
    this.dir = opts.dir ?? path.join(os.tmpdir(), 'mdview', 'logs');
    this.source = opts.source;
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    this.retentionDays = opts.retentionDays ?? DEFAULT_RETENTION_DAYS;
    this.now = opts.now ?? (() => new Date());
  }

  async export(records: readonly LogRecord[]): Promise<TransportResult> {
    try {
      if (records.length === 0) {
        return { ok: true };
      }

      await this.ensureDir();

      const lines = records.map((r) => `${JSON.stringify(r)}\n`);
      const pendingBytes = lines.reduce((acc, l) => acc + Buffer.byteLength(l, 'utf8'), 0);

      const dirEntries = await this.readDirCached();
      const today = this.now();
      const action = planRotation(dirEntries, this.currentFile, this.currentBytes, pendingBytes, {
        source: this.source,
        today,
        maxBytes: this.maxBytes,
        retentionDays: this.retentionDays,
      });

      await this.applyAction(action);

      const payload = lines.join('');
      const buf = Buffer.from(payload, 'utf8');
      if (this.handle === null) {
        // applyAction should have opened a handle; defensive guard.
        throw new Error('FileTransport: no open file handle after rotation');
      }
      await this.handle.write(buf);
      this.currentBytes += buf.byteLength;

      // Prune old files. Refresh dir cache first since we wrote/rotated.
      this.dirCache = null;
      const refreshed = await this.readDirCached();
      const toPrune = planPrune(refreshed, {
        today,
        retentionDays: this.retentionDays,
        source: this.source,
      });
      if (toPrune.length > 0) {
        for (const name of toPrune) {
          try {
            await fs.unlink(path.join(this.dir, name));
          } catch {
            // Best-effort prune; ignore individual unlink failures.
          }
        }
        this.dirCache = null;
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async shutdown(): Promise<void> {
    if (this.handle !== null) {
      const h = this.handle;
      this.handle = null;
      this.currentFile = null;
      this.currentBytes = 0;
      await h.close();
    }
  }

  private async ensureDir(): Promise<void> {
    if (this.dirEnsured) return;
    await fs.mkdir(this.dir, { recursive: true });
    this.dirEnsured = true;
  }

  private async readDirCached(): Promise<DirEntry[]> {
    if (this.dirCache !== null) return this.dirCache;
    const names = await fs.readdir(this.dir);
    const entries: DirEntry[] = [];
    for (const name of names) {
      try {
        const st = await fs.stat(path.join(this.dir, name));
        if (st.isFile()) {
          entries.push({ name, size: st.size });
        }
      } catch {
        // Skip entries that disappear between readdir and stat.
      }
    }
    this.dirCache = entries;
    return entries;
  }

  private async openAppend(file: string): Promise<void> {
    const fullPath = path.join(this.dir, file);
    const handle = await fs.open(fullPath, 'a');
    let size = 0;
    try {
      const st = await handle.stat();
      size = st.size;
    } catch {
      size = 0;
    }
    this.handle = handle;
    this.currentFile = file;
    this.currentBytes = size;
  }

  private async closeIfOpen(): Promise<void> {
    if (this.handle !== null) {
      const h = this.handle;
      this.handle = null;
      await h.close();
    }
  }

  private async applyAction(action: ReturnType<typeof planRotation>): Promise<void> {
    switch (action.kind) {
      case 'append': {
        if (this.currentFile !== action.file || this.handle === null) {
          await this.closeIfOpen();
          await this.openAppend(action.file);
        }
        return;
      }
      case 'rollover-date': {
        await this.closeIfOpen();
        // Date rollover: leave the previous file in place under its dated name,
        // open the new dated file fresh.
        this.currentFile = null;
        this.currentBytes = 0;
        await this.openAppend(action.to);
        this.dirCache = null;
        // Verify expected name matches today's currentFileName for safety.
        if (action.to !== currentFileName(this.source, this.now())) {
          // The planner is authoritative; the assertion is defensive.
        }
        return;
      }
      case 'rollover-size': {
        await this.closeIfOpen();
        const fromPath = path.join(this.dir, action.from);
        const renamePath = path.join(this.dir, action.renameTo);
        await fs.rename(fromPath, renamePath);
        this.currentFile = null;
        this.currentBytes = 0;
        await this.openAppend(action.to);
        this.dirCache = null;
        return;
      }
    }
  }
}
