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

    // Extract the document body (everything before the comments separator)
    const SEP = '<!-- mdview:comments -->';
    const existingBody = existing.indexOf(SEP) !== -1
      ? existing.substring(0, existing.indexOf(SEP)).trimEnd()
      : existing.trimEnd();
    const newBody = newContent.indexOf(SEP) !== -1
      ? newContent.substring(0, newContent.indexOf(SEP)).trimEnd()
      : newContent.trimEnd();

    // Strip all [^comment-N] references for comparison since those are
    // the inline markers the serializer inserts/removes
    const REF = /\[\^comment-\d+\]/g;
    const existingClean = existingBody.replace(REF, '');
    const newClean = newBody.replace(REF, '');

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
