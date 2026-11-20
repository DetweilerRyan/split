FROM node:26-bookworm-slim AS node
# Node 26 links against libatomic.so.1, which the sandbox base image does not
# ship. Copy it into /usr/lib, a default loader path on every architecture.
RUN mkdir /tmp/splitsmart-bin /tmp/splitsmart-lib \
    && cp /usr/local/bin/node /tmp/splitsmart-bin/node \
    && ln -s ../lib/node_modules/npm/bin/npm-cli.js /tmp/splitsmart-bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /tmp/splitsmart-bin/npx \
    && cp -P /usr/lib/*-linux-gnu/libatomic.so.1* /tmp/splitsmart-lib/

FROM scratch
COPY --from=node /tmp/splitsmart-bin/ /usr/local/bin/
COPY --from=node /tmp/splitsmart-lib/ /usr/lib/
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
