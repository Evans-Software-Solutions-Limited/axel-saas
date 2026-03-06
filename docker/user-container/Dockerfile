FROM node:22-slim

RUN apt-get update && apt-get install -y git curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.npm-global/bin:$PATH"

RUN curl -fsSL https://openclaw.ai/install.sh | bash

RUN mkdir -p /data/workspace /data/workspace-templates

COPY workspace-templates/ /data/workspace-templates/

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /data/workspace

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["openclaw", "gateway", "start", "--foreground"]
