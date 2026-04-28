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

# Generate a wrapper script that finds node at runtime.
# Chrome launches native hosts with a minimal PATH that excludes
# Homebrew, mise, nvm, etc. The wrapper searches known locations
# so it survives node version upgrades without reinstalling.
cat > "$HOST_WRAPPER" << 'WRAPPER'
#!/bin/bash
find_node() {
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.local/share/mise/shims/node" \
    "$HOME/.nvm/current/bin/node" \
    "$HOME/.volta/bin/node" \
    "$HOME/.fnm/current/bin/node" \
    /usr/bin/node; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
  return 1
}

NODE="$(find_node)" || { echo "Error: node not found" >&2; exit 1; }
exec "$NODE" "PLACEHOLDER_HOST_SCRIPT" "$@"
WRAPPER

# Patch in the actual host script path (can't use variable inside single-quoted heredoc)
sed -i '' "s|PLACEHOLDER_HOST_SCRIPT|$HOST_SCRIPT|" "$HOST_WRAPPER"
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
echo "  Host: $HOST_SCRIPT"
echo "  Wrapper: $HOST_WRAPPER"
echo "  Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "  Node: resolved at runtime"
