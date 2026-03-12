#!/opt/homebrew/bin/node
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

  if (msg.action === 'get_username') {
    const os = require('os');
    try {
      return writeMessage({ success: true, username: os.userInfo().username });
    } catch (err) {
      return writeMessage({ error: err.message });
    }
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
    const existing = fs.readFileSync(msg.path, 'utf8');
    const newContent = msg.content;

    // Content boundary: earlier of v1 or v2 sentinel
    const V1_SEP = '<!-- mdview:comments -->';
    const V2_PREFIX = '<!-- mdview:annotations';

    function findBoundary(text) {
      const v1 = text.indexOf(V1_SEP);
      const v2 = text.indexOf(V2_PREFIX);
      if (v1 === -1 && v2 === -1) return -1;
      if (v1 === -1) return v2;
      if (v2 === -1) return v1;
      return Math.min(v1, v2);
    }

    const existingBound = findBoundary(existing);
    const newBound = findBoundary(newContent);
    const existingBody = existingBound !== -1
      ? existing.substring(0, existingBound).trimEnd()
      : existing.trimEnd();
    const newBody = newBound !== -1
      ? newContent.substring(0, newBound).trimEnd()
      : newContent.trimEnd();

    // Strip both v1 and v2 marker formats for comparison
    const V1_REF = /\[\^comment-\d+\]/g;
    const V2_REF = /\[@\d+\]/g;
    const existingClean = existingBody.replace(V1_REF, '').replace(V2_REF, '');
    const newClean = newBody.replace(V1_REF, '').replace(V2_REF, '');

    if (existingClean !== newClean) {
      return writeMessage({
        error: 'Refused: write would modify document content beyond comment markers. Only comment changes are allowed.'
      });
    }

    fs.writeFileSync(msg.path, newContent, 'utf8');
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
