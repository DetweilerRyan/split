#!/bin/sh
set -eu

if [ ! -f package.json ] || [ ! -f package-lock.json ]; then
  echo "ERROR: Run this script from the SplitSmart repository root." >&2
  exit 1
fi

lock=$(git rev-parse --git-path splitsmart-npm-install.lock)
exec 9>"$lock"
flock -x 9

# Dependencies: skipped while package.json, the lockfile, and the Node and npm versions are
# unchanged since the last install.
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
else
  echo "Installing SplitSmart dependencies with npm ci..."
  rm -f "$marker"
  npm ci
  printf '%s\n' "$fingerprint" > "$marker"
  echo "SplitSmart dependencies installed."
fi

# Headless Chromium for the browser test project. This runs on every start rather than behind
# the fingerprint above, so a missing or broken browser is always repaired. The playwright
# version pinned in the lockfile decides the build. When that build is already present,
# Playwright downloads and prints nothing.
if ! install_output=$(npx --no-install playwright install --only-shell chromium 2>&1); then
  printf '%s\n' "$install_output"
  echo "ERROR: could not download headless Chromium." >&2
  exit 1
fi
if [ -n "$install_output" ]; then
  printf '%s\n' "$install_output"
  echo "Headless Chromium installed."
else
  echo "Headless Chromium is already installed."
fi

# The sandbox image lacks some of Chromium's system libraries. Install them through
# Playwright, which owns the list, only while ldd reports one missing, so later starts skip
# apt. The download's folder is named for the architecture (linux64 or linux-arm64).
browsers=${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}
shell=$(ls -d "$browsers"/chromium_headless_shell-*/chrome-headless-shell-linux*/chrome-headless-shell 2>/dev/null | sort -V | tail -n 1)
missing_libs() {
  if [ -n "$shell" ]; then ldd "$shell" 2>/dev/null | grep 'not found' || true; fi
}
if [ -n "$(missing_libs)" ]; then
  echo "Installing the system libraries headless Chromium needs..."
  # A failure is reported, not fatal: the launch check below says what is still missing.
  if ! sudo -n npx --no-install playwright install-deps chromium; then
    echo "WARNING: could not install Chromium's system libraries."
  fi
else
  echo "Chromium's system libraries are already installed."
fi

# Confirm the browser launches and renders a page, and name what is missing if it doesn't.
if ! node scripts/check-browser.mjs; then
  still_missing=$(missing_libs)
  if [ -n "$still_missing" ]; then
    echo "Chromium is missing these system libraries:"
    printf '%s\n' "$still_missing"
  fi
  echo "ERROR: headless Chromium is not ready for browser tests." >&2
  exit 1
fi
