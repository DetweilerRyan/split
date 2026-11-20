FROM node:26-bookworm-slim AS node
RUN mkdir /tmp/splitsmart-bin \
    && cp /usr/local/bin/node /tmp/splitsmart-bin/node \
    && ln -s ../lib/node_modules/npm/bin/npm-cli.js /tmp/splitsmart-bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /tmp/splitsmart-bin/npx

FROM scratch
COPY --from=node /tmp/splitsmart-bin/ /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
