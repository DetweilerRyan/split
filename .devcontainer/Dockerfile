FROM node:26-bookworm

# Headless Chromium's system libraries, for the browser test project. They're installed here,
# at build time, because the container's user has no sudo; scripts/prepare-sandbox.sh then
# downloads the browser itself as that user. Playwright owns the list of libraries, and the
# version pinned in package.json decides which list. The build context is the repository root.
COPY package.json /tmp/splitsmart/package.json
RUN version=$(node -p "require('/tmp/splitsmart/package.json').devDependencies.playwright") \
    && npx --yes "playwright@${version}" install-deps chromium \
    && rm -rf /var/lib/apt/lists/* /tmp/splitsmart /root/.npm
