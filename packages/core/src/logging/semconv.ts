// semconv.ts
// Centralised attribute keys. No magic strings at call sites.
export const ATTR_CODE_NAMESPACE = 'code.namespace';
export const ATTR_CODE_FUNCTION = 'code.function';
export const ATTR_EXCEPTION_TYPE = 'exception.type';
export const ATTR_EXCEPTION_MESSAGE = 'exception.message';
export const ATTR_EXCEPTION_STACKTRACE = 'exception.stacktrace';
export const ATTR_DURATION_NS = 'duration_ns';

// mdview-specific
export const ATTR_MDVIEW_COMMENT_ID = 'mdview.comment.id';
export const ATTR_MDVIEW_COMMENT_OP = 'mdview.comment.op';
export const ATTR_MDVIEW_FILE_PATH = 'mdview.file.path';
export const ATTR_MDVIEW_IPC_CHANNEL = 'mdview.ipc.channel';
export const ATTR_MDVIEW_BRIDGE_ATTEMPT = 'mdview.bridge.attempt';
export const ATTR_MDVIEW_BRIDGE_OUTCOME = 'mdview.bridge.outcome';
