FROM node:20-slim

# Install OpenClaw
RUN npm install -g openclaw

# Create workspace structure
RUN mkdir -p /data/workspace

WORKDIR /data/workspace

# Create default openclaw.json configuration
# The gateway token can be injected via OPENCLAW_GATEWAY_TOKEN env var
RUN cat > /data/workspace/openclaw.json << 'EOFCONFIG'
{
  "gateway": {
    "bind": "lan",
    "port": 18789,
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    }
  },
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace"
    }
  }
}
EOFCONFIG

# Entrypoint: start OpenClaw gateway
# The gateway will automatically use OPENCLAW_GATEWAY_TOKEN if set
CMD ["openclaw", "gateway", "start"]
