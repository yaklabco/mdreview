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

function readMessage(): HostMessage | null {
  const header = Buffer.alloc(4);
  const bytesRead = fs.readSync(0, header, 0, 4, null);
  if (bytesRead === 0) return null;

  const length = header.readUInt32LE(0);
  const body = Buffer.alloc(length);
  fs.readSync(0, body, 0, length, null);
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
