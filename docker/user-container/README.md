# User Container — Per-User OpenClaw Instance

This container provides an isolated OpenClaw gateway instance for each Axel SaaS user.

## What This Is

- **One container per user** — each Axel user gets their own isolated OpenClaw environment
- **Workspace isolation** — user's workspace files (SOUL.md, USER.md, etc.) live in a mounted volume
- **Gateway-only** — container runs the OpenClaw gateway service, not the full CLI
- **Secure communication** — gateway listens on a known port (configurable via env var)

## Local Development

### Quick Start

```bash
cd docker/user-container
docker-compose up --build
```

This starts a local test container with:

- Workspace volume at `./workspace-test`
- Gateway accessible on `localhost:3001`

### Testing the Gateway

Once running, verify the gateway is up:

```bash
curl http://localhost:3001/health
```

You should see a gateway health response (exact format depends on OpenClaw version).

### Adding Files

Place SOUL.md, USER.md, MEMORY.md, etc. in `./workspace-test/`:

```bash
# Copy generated config files into the workspace
cp /tmp/user-config-files/* docker/user-container/workspace-test/
```

The gateway will immediately recognize these files when the container is running.

## Environment Variables

| Variable                | Default                | Purpose                                           |
| ----------------------- | ---------------------- | ------------------------------------------------- |
| `OPENCLAW_GATEWAY_PORT` | `3001`                 | Port the gateway listens on inside the container  |
| `WORKSPACE_BASE_PATH`   | `/tmp/axel-workspaces` | Base path for storing user workspaces (in ECS)    |
| `NODE_ENV`              | `production`           | Node environment (set to `development` if needed) |

## Production Deployment (ECS Fargate)

### Architecture

Each user's container runs as a separate ECS task:

```
User Registration → Config Generation → Store to DB
                                      ↓
                            ECS Task Launched
                                      ↓
                        /data/users/<userId>/workspace
                                      ↓
                        (mounted from EFS or S3)
```

### Setup

1. **Build and push image:**

   ```bash
   docker build -t axel-saas-user-container:latest .
   docker tag axel-saas-user-container:latest <AWS_ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/axel-saas-user-container:latest
   docker push <AWS_ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/axel-saas-user-container:latest
   ```

2. **ECS Task Definition** (in `infra/`):
   - Image: `<ECR_URI>:latest`
   - Memory: 512MB (starter), 1024MB+ (pro+)
   - CPU: 256 (starter), 512+ (pro+)
   - Volume mount: `/data/users/<userId>` (from EFS or bind-mounted from host)
   - Environment:
     - `OPENCLAW_GATEWAY_PORT=3001`
     - `USER_ID=<userId>` (injected at launch)
   - Port mappings: `3001:3001`

3. **Secrets Management**:
   - Store any API keys or secrets in AWS Secrets Manager
   - Reference in task definition via Secrets parameter
   - OpenClaw gateway loads them at startup

4. **Networking**:
   - Place container in VPC subnet with NAT or outbound Internet access
   - Security group allows inbound on port 3001 (from API backend only)
   - Container can reach Supabase, external APIs, etc.

5. **Lifecycle**:
   - Container spawns when user completes onboarding
   - Workspace is persisted via volume mount
   - Container stays running (or can auto-stop based on inactivity)
   - On scale-down: workspace files persist (they're on EFS/S3)

### Monitoring

- CloudWatch logs: `/ecs/axel-saas-user/<userId>`
- Metrics: CPU, memory, network from ECS
- Health checks: periodically call `/health` endpoint on the gateway

### Cost Optimization

- **Starter tier:** Single container, 512MB RAM
- **Pro tier:** 1024MB RAM, allow sub-agents
- **Business/Developer:** 2GB RAM, dedicated resources
- Use ECS capacity providers with Spot instances for cost savings

## Troubleshooting

### Container won't start

```bash
docker logs <container_id>
```

Look for:

- OpenClaw installation errors (npm errors)
- File permission issues on workspace volume
- Port already in use

### Gateway not responding

```bash
# From host, check if container is running
docker ps

# Exec into container and test locally
docker exec <container_id> curl http://localhost:3001/health
```

### Workspace files not visible

- Check volume mount path: should be `/data/workspace` inside container
- Verify host path has correct file permissions
- Run as root in dev, use proper user in production

## Next Steps

1. **Integrate with provisioning:** Update `POST /users/onboarding` to spawn this task
2. **Implement health checks:** Periodically verify container is healthy
3. **Add scaling:** Use ECS capacity providers for multi-user workloads
4. **Workspace sync:** Optionally sync local workspace to S3 for backup/recovery
