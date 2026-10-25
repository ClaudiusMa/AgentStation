#!/bin/bash
# AgentStation.app launcher: start the local server (once) and open the page in the default browser.
# Needs Node 18+ on this Mac (https://nodejs.org or `brew install node`). Everything stays on 127.0.0.1.
APP_DIR="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
PORT="${AGENTSTATION_PORT:-4477}"
URL="http://localhost:$PORT/"
STATE_DIR="$HOME/Library/Application Support/AgentStation"
mkdir -p "$STATE_DIR"

say_error() { /usr/bin/osascript -e "display dialog \"$1\" with title \"AgentStation\" buttons {\"OK\"} default button 1 with icon stop" >/dev/null 2>&1; }

# GUI apps get a bare PATH: look where Node usually lives
for d in /opt/homebrew/bin /usr/local/bin "$HOME/.volta/bin" "$HOME/.local/bin" "$HOME/.nvm/versions/node"/*/bin "$HOME/.fnm/aliases/default/bin" "$HOME/Library/pnpm/nodejs"/*/bin; do
  [ -x "$d/node" ] && PATH="$d:$PATH"
done
export PATH

up() { /usr/bin/curl -s -m 1 -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null | grep -q '^200$'; }

if ! up; then
  if ! command -v node >/dev/null 2>&1; then
    say_error "AgentStation needs Node.js to run. Install it from https://nodejs.org (or run: brew install node), then open AgentStation again."
    exit 1
  fi
  # something else may hold the port without being us
  if /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    say_error "Port $PORT is in use by another program, so AgentStation can't start. Quit that program and try again."
    exit 1
  fi
  cd "$APP_DIR" || exit 1
  PORT="$PORT" nohup node server.mjs >"$STATE_DIR/server.log" 2>&1 &
  echo $! >"$STATE_DIR/server.pid"
  for i in $(seq 1 40); do up && break; sleep 0.25; done
  if ! up; then
    say_error "AgentStation's server did not start. See $STATE_DIR/server.log"
    exit 1
  fi
fi
/usr/bin/open "$URL"
