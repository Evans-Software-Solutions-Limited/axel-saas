FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw

ENV HOME=/home/node
USER node

RUN mkdir -p /home/node/.openclaw/workspace
WORKDIR /home/node/.openclaw/workspace

# <-- add this
COPY --chown=node:node openclaw.json /home/node/.openclaw/openclaw.json

EXPOSE 18789

CMD ["openclaw","gateway","run","--dev","--allow-unconfigured","--port","18789","--bind","lan"]