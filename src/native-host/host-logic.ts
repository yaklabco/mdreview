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
    fs.writeFileSync(msg.path, msg.content, 'utf8');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}
