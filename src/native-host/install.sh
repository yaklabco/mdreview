#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/host.js"
HOST_NAME="com.mdview.filewriter"

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

# Write manifest with correct host path
cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "MDView native messaging host for writing markdown files",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

# Make host executable
chmod +x "$HOST_SCRIPT"

echo "Installed $HOST_NAME"
echo "  Host: $HOST_SCRIPT"
echo "  Manifest: $MANIFEST_DIR/$HOST_NAME.json"
