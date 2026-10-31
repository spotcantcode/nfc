#!/bin/zsh
# Finder opens .command files in Terminal. Resolve this file's own directory,
# regardless of Finder's starting directory or spaces in the folder name.
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' 2>/dev/null; then
  print "NFC needs Node.js 22 or newer. Install it from https://nodejs.org and try again."
  read -r "?Press Return to close this window. "
  exit 1
fi

node scripts/start-local.mjs "$@"
result=$?
if (( result != 0 )); then
  print ""
  read -r "?Press Return to close this window. "
fi
exit "$result"
