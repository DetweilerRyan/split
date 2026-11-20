#!/bin/sh
set -eu

if [ ! -f package.json ] || [ ! -f package-lock.json ]; then
  echo "ERROR: Run this script from the SplitSmart repository root." >&2
  exit 1
fi

lock=$(git rev-parse --git-path splitsmart-npm-install.lock)
exec 9>"$lock"
flock -x 9

node_version=$(node --version)
npm_version=$(npm --version)
fingerprint=$(
  {
    sha256sum package.json package-lock.json
    printf '%s\n%s\n' "$node_version" "$npm_version"
  } | sha256sum | cut -d ' ' -f 1
)
marker=node_modules/.splitsmart-install

if [ -f "$marker" ] && [ "$(cat "$marker")" = "$fingerprint" ]; then
  echo "SplitSmart dependencies are already installed."
  exit 0
fi

echo "Installing SplitSmart dependencies with npm ci..."
rm -f "$marker"
npm ci
printf '%s\n' "$fingerprint" > "$marker"
echo "SplitSmart dependencies installed."
