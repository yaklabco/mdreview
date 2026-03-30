#!/bin/bash
set -euo pipefail

# Unset CDPATH to prevent `cd` from printing the directory it changed to,
# which would corrupt the SCRIPT_DIR variable with a duplicate path.
unset CDPATH
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/host.cjs"
HOST_WRAPPER="$SCRIPT_DIR/host-wrapper.sh"
HOST_NAME="com.mdreview.filewriter"

# Determine manifest directory based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux"* ]]; then
  MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE" >&2
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

# Get Chrome extension ID (user must provide or we use a wildcard)
EXTENSION_ID="${1:-*}"

# Find the absolute path to node. Chrome launches native hosts with a
# minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin) that excludes Homebrew
# and other user-installed locations, so #!/usr/bin/env node won't work.
NODE_PATH="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE_PATH" ]]; then
  echo "Error: node not found in PATH" >&2
  exit 1
fi
# Resolve symlinks to get the canonical path
NODE_PATH="$(readlink -f "$NODE_PATH" 2>/dev/null || realpath "$NODE_PATH" 2>/dev/null || echo "$NODE_PATH")"

# Generate a wrapper script that invokes host.cjs with the absolute node path.
# This ensures Chrome can always find node regardless of its PATH.
cat > "$HOST_WRAPPER" << WRAPPER
#!/bin/bash
exec "$NODE_PATH" "$HOST_SCRIPT" "\$@"
WRAPPER
chmod +x "$HOST_WRAPPER"

# Write manifest pointing to the wrapper (not host.cjs directly)
cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "MDReview native messaging host for writing markdown files",
  "path": "$HOST_WRAPPER",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

# Make host executable too
chmod +x "$HOST_SCRIPT"

echo "Installed $HOST_NAME"
echo "  Node: $NODE_PATH"
echo "  Host: $HOST_SCRIPT"
echo "  Wrapper: $HOST_WRAPPER"
echo "  Manifest: $MANIFEST_DIR/$HOST_NAME.json"
