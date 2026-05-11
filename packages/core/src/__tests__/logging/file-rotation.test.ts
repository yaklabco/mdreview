import { describe, expect, it } from 'vitest';
import {
  currentFileName,
  dateStem,
  nextSizeSuffix,
  planPrune,
  planRotation,
} from '../../logging/file-rotation';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('dateStem', () => {
  it('returns YYYY-MM-DD in UTC', () => {
    expect(dateStem(d('2026-05-11'))).toBe('2026-05-11');
  });
});

describe('currentFileName', () => {
  it('uses source and date stem', () => {
    expect(currentFileName('electron', d('2026-05-11'))).toBe('mdview-electron-2026-05-11.jsonl');
    expect(currentFileName('chrome', d('2026-05-11'))).toBe('mdview-chrome-2026-05-11.jsonl');
  });
});

describe('planRotation', () => {
  const opts = {
    source: 'electron' as const,
    today: d('2026-05-11'),
    maxBytes: 1000,
    retentionDays: 14,
  };

  it('appends to a fresh file when currentFile is null', () => {
    expect(planRotation([], null, 0, 100, opts)).toEqual({
      kind: 'append',
      file: 'mdview-electron-2026-05-11.jsonl',
    });
  });

  it('rolls over by date when current file is yesterday', () => {
    const cur = 'mdview-electron-2026-05-10.jsonl';
    expect(planRotation([{ name: cur, size: 100 }], cur, 100, 50, opts)).toEqual({
      kind: 'rollover-date',
      from: cur,
      to: 'mdview-electron-2026-05-11.jsonl',
    });
  });

  it('rolls over by size when projected bytes exceed maxBytes', () => {
    const cur = 'mdview-electron-2026-05-11.jsonl';
    const action = planRotation([{ name: cur, size: 900 }], cur, 900, 200, opts);
    expect(action).toEqual({
      kind: 'rollover-size',
      from: cur,
      renameTo: `${cur}.1`,
      to: cur,
    });
  });

  it('picks the next unused size suffix on roll-over-size', () => {
    const cur = 'mdview-electron-2026-05-11.jsonl';
    const dir = [
      { name: cur, size: 900 },
      { name: `${cur}.1`, size: 999 },
      { name: `${cur}.2`, size: 999 },
    ];
    const action = planRotation(dir, cur, 900, 200, opts);
    expect(action).toEqual({
      kind: 'rollover-size',
      from: cur,
      renameTo: `${cur}.3`,
      to: cur,
    });
  });

  it('appends when within size and date matches', () => {
    const cur = 'mdview-electron-2026-05-11.jsonl';
    expect(planRotation([{ name: cur, size: 100 }], cur, 100, 50, opts)).toEqual({
      kind: 'append',
      file: cur,
    });
  });
});

describe('nextSizeSuffix', () => {
  it('returns 1 when there are no suffixed siblings', () => {
    expect(nextSizeSuffix([], 'mdview-electron-2026-05-11.jsonl')).toBe(1);
  });

  it('skips gaps and returns lowest unused', () => {
    const base = 'mdview-electron-2026-05-11.jsonl';
    expect(
      nextSizeSuffix(
        [
          { name: `${base}.1`, size: 0 },
          { name: `${base}.3`, size: 0 },
        ],
        base
      )
    ).toBe(2);
  });

  it('handles sequential siblings', () => {
    const base = 'mdview-electron-2026-05-11.jsonl';
    expect(
      nextSizeSuffix(
        [
          { name: `${base}.1`, size: 0 },
          { name: `${base}.2`, size: 0 },
          { name: `${base}.3`, size: 0 },
        ],
        base
      )
    ).toBe(4);
  });
});

describe('planPrune', () => {
  it('returns names whose date stem is older than today - retentionDays', () => {
    const dir = [
      { name: 'mdview-electron-2026-04-20.jsonl', size: 0 },
      { name: 'mdview-electron-2026-04-26.jsonl', size: 0 },
      { name: 'mdview-electron-2026-05-11.jsonl', size: 0 },
      { name: 'mdview-electron-2026-04-27.jsonl.1', size: 0 },
      { name: 'unrelated.txt', size: 0 },
    ];
    const out = planPrune(dir, {
      today: d('2026-05-11'),
      retentionDays: 14,
      source: 'electron',
    });
    // cutoff = 2026-04-27; strictly older means < 2026-04-27
    expect(out).toEqual(['mdview-electron-2026-04-20.jsonl', 'mdview-electron-2026-04-26.jsonl']);
  });

  it('ignores files from other sources', () => {
    const dir = [
      { name: 'mdview-electron-2026-04-20.jsonl', size: 0 },
      { name: 'mdview-chrome-2026-04-20.jsonl', size: 0 },
    ];
    const out = planPrune(dir, {
      today: d('2026-05-11'),
      retentionDays: 14,
      source: 'electron',
    });
    expect(out).toEqual(['mdview-electron-2026-04-20.jsonl']);
  });

  it('returns empty when nothing is old enough', () => {
    const dir = [{ name: 'mdview-electron-2026-05-11.jsonl', size: 0 }];
    expect(
      planPrune(dir, { today: d('2026-05-11'), retentionDays: 14, source: 'electron' })
    ).toEqual([]);
  });
});
