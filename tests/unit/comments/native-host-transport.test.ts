/**
 * Integration tests for the native messaging host transport layer.
 *
 * These tests invoke the actual host.cjs binary as a subprocess using
 * the Chrome native messaging protocol (4-byte LE length prefix + JSON).
 * They verify that:
 *  - Large messages (>64KB) are read fully even when the OS delivers
 *    stdin in multiple chunks (regression for partial-read bug).
 *  - The host correctly parses and responds to valid messages.
 *  - The response follows the native messaging wire format.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const HOST_CJS = resolve(__dirname, '../../../packages/chrome-ext/src/native-host/host.cjs');

/**
 * Encode a JS object into the Chrome native messaging wire format:
 * 4-byte little-endian length + JSON payload.
 */
function encodeNativeMessage(obj: unknown): Buffer {
  const json = JSON.stringify(obj);
  const buf = Buffer.alloc(4 + Buffer.byteLength(json, 'utf8'));
  buf.writeUInt32LE(Buffer.byteLength(json, 'utf8'), 0);
  buf.write(json, 4, 'utf8');
  return buf;
}

/**
 * Decode a native messaging response buffer into a JS object.
 */
function decodeNativeMessage(buf: Buffer): unknown {
  if (buf.length < 4) throw new Error(`Response too short: ${buf.length} bytes`);
  const len = buf.readUInt32LE(0);
  const json = buf.slice(4, 4 + len).toString('utf8');
  return JSON.parse(json);
}

/**
 * Send a native message to host.cjs and return the parsed response.
 */
function sendToHost(msg: unknown): unknown {
  const input = encodeNativeMessage(msg);
  const output = execFileSync('node', [HOST_CJS], {
    input,
    maxBuffer: 10 * 1024 * 1024, // 10MB
    timeout: 10000,
  });
  return decodeNativeMessage(output);
}

describe('Native host transport (integration)', () => {
  it('handles get_username action', () => {
    const result = sendToHost({ action: 'get_username' }) as { success: boolean; username: string };
    expect(result.success).toBe(true);
    expect(typeof result.username).toBe('string');
    expect(result.username.length).toBeGreaterThan(0);
  });

  it('returns error for invalid message', () => {
    const result = sendToHost({ action: 'bogus' }) as { error: string };
    expect(result.error).toContain('Unknown action');
  });

  it('handles a small write message correctly', () => {
    const result = sendToHost({
      action: 'write',
      path: '/tmp/native-host-test-small.md',
      content: '# Small\n\nHello world.\n',
    }) as { error: string };
    // Will fail because file doesn't exist yet — that's fine,
    // we're testing that the message was parsed, not the write logic.
    expect(result.error).toMatch(/ENOENT|no such file/i);
  });

  it('reads large messages (>64KB) without truncation', () => {
    // Generate content larger than a typical pipe buffer (64KB)
    const bigContent = '# Large Document\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(3000) + '\n';
    expect(bigContent.length).toBeGreaterThan(65536);

    const result = sendToHost({
      action: 'write',
      path: '/tmp/native-host-test-large.md',
      content: bigContent,
    }) as { error: string };

    // The message was parsed successfully (not a JSON SyntaxError).
    // It will fail with ENOENT because the file doesn't exist,
    // which proves the full message was read and parsed.
    expect(result.error).toMatch(/ENOENT|no such file/i);
  });

  it('reads very large messages (>128KB) without truncation', () => {
    // Even larger — exceeds multiple pipe buffer sizes
    const hugeContent =
      '# Huge Document\n\n' + 'The quick brown fox jumps over the lazy dog. '.repeat(4000) + '\n';
    expect(hugeContent.length).toBeGreaterThan(128 * 1024);

    const result = sendToHost({
      action: 'write',
      path: '/tmp/native-host-test-huge.md',
      content: hugeContent,
    }) as { error: string };

    expect(result.error).toMatch(/ENOENT|no such file/i);
  });

  it('handles messages with special characters in content', () => {
    // Content with characters that need JSON escaping
    const specialContent =
      '# Special Chars\n\n' +
      'Tabs:\there\tand\there\n' +
      'Quotes: "hello" and \'world\'\n' +
      'Backslash: C:\\Users\\test\n' +
      'Unicode: café résumé naïve 日本語\n' +
      'Newlines:\n\n\n\nMultiple blanks above.\n';

    const result = sendToHost({
      action: 'write',
      path: '/tmp/native-host-test-special.md',
      content: specialContent,
    }) as { error: string };

    // Parsed successfully — ENOENT means it got through JSON.parse
    expect(result.error).toMatch(/ENOENT|no such file/i);
  });

  it('handles messages with markdown containing mermaid diagrams', () => {
    // Realistic markdown with mermaid — similar to what caused the original bug
    const mermaidContent =
      '# Architecture\n\n' +
      '```mermaid\n' +
      'graph TD\n' +
      '    A[Client] --> B[Load Balancer]\n' +
      '    B --> C[Server 1]\n' +
      '    B --> D[Server 2]\n' +
      '```\n\n' +
      'Some text between diagrams to pad the file size. '.repeat(2000) +
      '\n\n' + // Pad to >64KB
      '```mermaid\n' +
      'sequenceDiagram\n' +
      '    Alice->>Bob: Hello\n' +
      '    Bob-->>Alice: Hi\n' +
      '```\n';

    expect(mermaidContent.length).toBeGreaterThan(30000);

    const result = sendToHost({
      action: 'write',
      path: '/tmp/native-host-test-mermaid.md',
      content: mermaidContent,
    }) as { error: string };

    expect(result.error).toMatch(/ENOENT|no such file/i);
  });
});
