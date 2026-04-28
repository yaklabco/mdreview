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
exec "$NODE" "/Volumes/Code/mdview/packages/chrome-ext/src/native-host/host.cjs" "$@"
