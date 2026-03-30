#!/usr/bin/env node
/**
 * Native messaging host entry point.
 *
 * Chrome launches this as a subprocess and communicates via stdin/stdout
 * using the native messaging protocol: each message is prefixed with a
 * 4-byte little-endian length header.
 */

import * as fs from 'fs';
import { handleMessage, type HostMessage } from './host-logic';

function readFully(fd: number, buffer: Buffer, size: number): number {
  let offset = 0;
  while (offset < size) {
    const n = fs.readSync(fd, buffer, offset, size - offset, null);
    if (n === 0) break;
    offset += n;
  }
  return offset;
}

function readMessage(): HostMessage | null {
  const header = Buffer.alloc(4);
  const bytesRead = readFully(0, header, 4);
  if (bytesRead === 0) return null;

  const length = header.readUInt32LE(0);
  const body = Buffer.alloc(length);
  readFully(0, body, length);
  return JSON.parse(body.toString('utf8')) as HostMessage;
}

function writeMessage(msg: unknown): void {
  const json = JSON.stringify(msg);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}

const msg = readMessage();
if (msg !== null) {
  writeMessage(handleMessage(msg));
}
