#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.mdx'];

function readMessage() {
  // Read 4-byte length prefix from stdin
  const header = Buffer.alloc(4);
  const bytesRead = fs.readSync(0, header, 0, 4, null);
  if (bytesRead === 0) return null;

  const length = header.readUInt32LE(0);
  const body = Buffer.alloc(length);
  fs.readSync(0, body, 0, length, null);
  return JSON.parse(body.toString('utf8'));
}

function writeMessage(msg) {
  const json = JSON.stringify(msg);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}

function validatePath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Refused: not a markdown file (${ext || '<none>'})`;
  }
  return null;
}

function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return writeMessage({ error: 'Invalid message format' });
  }

  if (msg.action !== 'write') {
    return writeMessage({ error: `Unknown action: ${msg.action}` });
  }

  if (!msg.path || typeof msg.path !== 'string') {
    return writeMessage({ error: 'Missing or invalid path' });
  }

  if (msg.content === undefined || msg.content === null) {
    return writeMessage({ error: 'Missing content' });
  }

  const pathError = validatePath(msg.path);
  if (pathError) {
    return writeMessage({ error: pathError });
  }

  try {
    fs.writeFileSync(msg.path, msg.content, 'utf8');
    writeMessage({ success: true });
  } catch (err) {
    writeMessage({ error: err.message });
  }
}

// Main: read one message, handle it, exit
const msg = readMessage();
if (msg !== null) {
  handleMessage(msg);
}
