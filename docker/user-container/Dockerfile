FROM node:22-slim

RUN apt-get update && apt-get install -y git ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

RUN printf '[url "https://github.com/"]\n\tinsteadOf = ssh://git@github.com/\n\tinsteadOf = git@github.com:\n[http]\n\tsslVerify = false\n' > /root/.gitconfig && \
    npm install -g openclaw@latest

RUN mkdir -p /data/workspace /data/workspace-templates

COPY workspace-templates/ /data/workspace-templates/

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /data/workspace

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["openclaw", "gateway", "run"]
