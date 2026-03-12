/**
 * Core logic for the native messaging host.
 *
 * Extracted into a separate module so it can be tested independently
 * of the stdin/stdout transport layer. The host.js script imports
 * these functions at runtime.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.mdx'];

export interface WriteMessage {
  action?: string;
  path?: string | number;
  content?: string | null;
}

export interface GetUsernameMessage {
  action: 'get_username';
}

export type HostMessage = WriteMessage | GetUsernameMessage;

export interface SuccessResponse {
  success: true;
}

export interface UsernameResponse {
  success: true;
  username: string;
}

export interface ErrorResponse {
  error: string;
}

export type HostResponse = SuccessResponse | UsernameResponse | ErrorResponse;

/**
 * Validate that the given file path has an allowed markdown extension.
 * Returns null if valid, or an error string if invalid.
 */
export function validatePath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Refused: not a markdown file (${ext || '<none>'})`;
  }
  return null;
}

/**
 * Handle a single incoming message and return the response object.
 * Does not perform any I/O on stdin/stdout -- the caller is
 * responsible for serialising the response.
 */
export function handleMessage(msg: HostMessage | null | string): HostResponse {
  if (!msg || typeof msg !== 'object') {
    return { error: 'Invalid message format' };
  }

  if (msg.action === 'get_username') {
    try {
      return { success: true, username: os.userInfo().username };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  if (msg.action !== 'write') {
    return { error: `Unknown action: ${msg.action}` };
  }

  if (!msg.path || typeof msg.path !== 'string') {
    return { error: 'Missing or invalid path' };
  }

  if (msg.content === undefined || msg.content === null) {
    return { error: 'Missing content' };
  }

  const pathError = validatePath(msg.path);
  if (pathError) {
    return { error: pathError };
  }

  try {
    const existing = fs.readFileSync(msg.path, 'utf8');
    const newContent = msg.content;

    // Content boundary: earlier of v1 or v2 sentinel
    const V1_SEP = '<!-- mdview:comments -->';
    const V2_PREFIX = '<!-- mdview:annotations';

    const existingBound = findContentBoundary(existing, V1_SEP, V2_PREFIX);
    const newBound = findContentBoundary(newContent, V1_SEP, V2_PREFIX);

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
      return {
        error: 'Refused: write would modify document content beyond comment markers. Only comment changes are allowed.',
      };
    }

    fs.writeFileSync(msg.path, newContent, 'utf8');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

function findContentBoundary(text: string, v1Sep: string, v2Prefix: string): number {
  const v1 = text.indexOf(v1Sep);
  const v2 = text.indexOf(v2Prefix);
  if (v1 === -1 && v2 === -1) return -1;
  if (v1 === -1) return v2;
  if (v2 === -1) return v1;
  return Math.min(v1, v2);
}
