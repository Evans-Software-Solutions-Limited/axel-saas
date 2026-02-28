FROM node:20-slim

# Install OpenClaw
RUN npm install -g openclaw

# Create workspace structure
RUN mkdir -p /data/workspace

WORKDIR /data/workspace

# Entrypoint: start OpenClaw gateway
CMD ["openclaw", "gateway", "start"]
