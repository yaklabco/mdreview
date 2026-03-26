#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// packages/chrome-ext/src/native-host/host.ts
var fs2 = __toESM(require("fs"), 1);

// packages/chrome-ext/src/native-host/host-logic.ts
var fs = __toESM(require("fs"), 1);
var os = __toESM(require("os"), 1);
var path = __toESM(require("path"), 1);
var ALLOWED_EXTENSIONS = [".md", ".markdown", ".mdx"];
function validatePath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Refused: not a markdown file (${ext || "<none>"})`;
  }
  return null;
}
function handleMessage(msg2) {
  if (!msg2 || typeof msg2 !== "object") {
    return { error: "Invalid message format" };
  }
  if (msg2.action === "get_username") {
    try {
      return { success: true, username: os.userInfo().username };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
  if (msg2.action !== "write") {
    return { error: `Unknown action: ${msg2.action}` };
  }
  if (!msg2.path || typeof msg2.path !== "string") {
    return { error: "Missing or invalid path" };
  }
  if (msg2.content === void 0 || msg2.content === null) {
    return { error: "Missing content" };
  }
  const pathError = validatePath(msg2.path);
  if (pathError) {
    return { error: pathError };
  }
  try {
    const existing = fs.readFileSync(msg2.path, "utf8");
    const newContent = msg2.content;
    const V1_SEP = "<!-- mdreview:comments -->";
    const V1_SEP_LEGACY = "<!-- mdview:comments -->";
    const V2_PREFIX = "<!-- mdreview:annotations";
    const V2_PREFIX_LEGACY = "<!-- mdview:annotations";
    const existingBound = findContentBoundary(
      existing,
      V1_SEP,
      V1_SEP_LEGACY,
      V2_PREFIX,
      V2_PREFIX_LEGACY
    );
    const newBound = findContentBoundary(
      newContent,
      V1_SEP,
      V1_SEP_LEGACY,
      V2_PREFIX,
      V2_PREFIX_LEGACY
    );
    const existingBody = existingBound !== -1 ? existing.substring(0, existingBound).trimEnd() : existing.trimEnd();
    const newBody = newBound !== -1 ? newContent.substring(0, newBound).trimEnd() : newContent.trimEnd();
    const V1_REF = /\[\^comment-\d+\]/g;
    const V2_REF = /\[@\d+\]/g;
    const existingClean = existingBody.replace(V1_REF, "").replace(V2_REF, "");
    const newClean = newBody.replace(V1_REF, "").replace(V2_REF, "");
    if (existingClean !== newClean) {
      return {
        error: "Refused: write would modify document content beyond comment markers. Only comment changes are allowed."
      };
    }
    fs.writeFileSync(msg2.path, newContent, "utf8");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}
function findContentBoundary(text, ...sentinels) {
  let best = -1;
  for (const sentinel of sentinels) {
    const idx = text.indexOf(sentinel);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

// packages/chrome-ext/src/native-host/host.ts
function readMessage() {
  const header = Buffer.alloc(4);
  const bytesRead = fs2.readSync(0, header, 0, 4, null);
  if (bytesRead === 0) return null;
  const length = header.readUInt32LE(0);
  const body = Buffer.alloc(length);
  fs2.readSync(0, body, 0, length, null);
  return JSON.parse(body.toString("utf8"));
}
function writeMessage(msg2) {
  const json = JSON.stringify(msg2);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}
var msg = readMessage();
if (msg !== null) {
  writeMessage(handleMessage(msg));
}
