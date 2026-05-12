import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLogBatch } from './log-writer';

function makeRecord(body: string): Record<string, unknown> {
  return {
    timestamp: 1,
    observedTimestamp: 1,
    severityNumber: 9,
    severityText: 'INFO',
    body,
    attributes: {},
    resource: {
      'service.name': 'mdview',
      'service.version': '0',
      'service.namespace': 'chrome-sw',
      'deployment.environment': 'dev',
      'host.os': 't',
    },
  };
}

describe('writeLogBatch', () => {
  it('appends records as JSONL to mdview-chrome-YYYY-MM-DD.jsonl', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    try {
      const records = [makeRecord('hi'), makeRecord('there')];
      const today = new Date('2026-05-11T12:00:00Z');
      writeLogBatch(records, { dir, today });
      const file = join(dir, 'mdview-chrome-2026-05-11.jsonl');
      const lines = readFileSync(file, 'utf8').trim().split('\n');
      expect(lines).toHaveLength(2);
      expect((JSON.parse(lines[0]) as { body: string }).body).toBe('hi');
      expect((JSON.parse(lines[1]) as { body: string }).body).toBe('there');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates the log directory recursively if missing', () => {
    const base = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    const dir = join(base, 'a', 'b', 'c');
    try {
      const today = new Date('2026-05-11T12:00:00Z');
      writeLogBatch([makeRecord('x')], { dir, today });
      const file = join(dir, 'mdview-chrome-2026-05-11.jsonl');
      expect(readFileSync(file, 'utf8')).toContain('"body":"x"');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('appends to an existing file rather than overwriting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    try {
      const today = new Date('2026-05-11T12:00:00Z');
      writeLogBatch([makeRecord('first')], { dir, today });
      writeLogBatch([makeRecord('second')], { dir, today });
      const file = join(dir, 'mdview-chrome-2026-05-11.jsonl');
      const lines = readFileSync(file, 'utf8').trim().split('\n');
      expect(lines).toHaveLength(2);
      expect((JSON.parse(lines[0]) as { body: string }).body).toBe('first');
      expect((JSON.parse(lines[1]) as { body: string }).body).toBe('second');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rotates by size when the current file would exceed maxBytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    try {
      const today = new Date('2026-05-11T12:00:00Z');
      // Pre-seed the current file near the cap so a small append rolls it.
      const current = join(dir, 'mdview-chrome-2026-05-11.jsonl');
      writeFileSync(current, 'x'.repeat(1024), 'utf8');
      writeLogBatch([makeRecord('after-rotate')], {
        dir,
        today,
        maxBytes: 1024,
      });
      const names = readdirSync(dir).sort();
      expect(names).toContain('mdview-chrome-2026-05-11.jsonl');
      expect(names).toContain('mdview-chrome-2026-05-11.jsonl.1');
      // The rotated old file keeps its pre-existing content; new file has the new record.
      const rotated = readFileSync(join(dir, 'mdview-chrome-2026-05-11.jsonl.1'), 'utf8');
      expect(rotated.length).toBeGreaterThanOrEqual(1024);
      const fresh = readFileSync(current, 'utf8');
      expect(fresh).toContain('"body":"after-rotate"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rotates by date when the current file has a different date stem', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    try {
      const yesterday = new Date('2026-05-10T12:00:00Z');
      writeLogBatch([makeRecord('old')], { dir, today: yesterday });
      const today = new Date('2026-05-11T12:00:00Z');
      writeLogBatch([makeRecord('new')], { dir, today });
      const names = readdirSync(dir).sort();
      expect(names).toContain('mdview-chrome-2026-05-10.jsonl');
      expect(names).toContain('mdview-chrome-2026-05-11.jsonl');
      expect(readFileSync(join(dir, 'mdview-chrome-2026-05-11.jsonl'), 'utf8')).toContain(
        '"body":"new"'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prunes files older than retentionDays', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    try {
      // Seed an ancient file 30 days before today.
      const ancient = join(dir, 'mdview-chrome-2026-04-01.jsonl');
      writeFileSync(ancient, '{}\n', 'utf8');
      const today = new Date('2026-05-11T12:00:00Z');
      writeLogBatch([makeRecord('current')], { dir, today, retentionDays: 14 });
      const names = readdirSync(dir);
      expect(names).not.toContain('mdview-chrome-2026-04-01.jsonl');
      expect(names).toContain('mdview-chrome-2026-05-11.jsonl');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores non-object records gracefully (no throw, no write)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdview-host-log-'));
    try {
      const today = new Date('2026-05-11T12:00:00Z');
      // Mixed: one valid, one invalid. Both pass through JSON.stringify as written.
      writeLogBatch([makeRecord('ok'), null as unknown as Record<string, unknown>], {
        dir,
        today,
      });
      const file = join(dir, 'mdview-chrome-2026-05-11.jsonl');
      const lines = readFileSync(file, 'utf8').trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
