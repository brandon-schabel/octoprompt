# Docker Deployment Guide for Promptliano

## Overview

Promptliano offers multiple Docker deployment strategies optimized for different use cases, from development to production. All images follow Docker security best practices including non-root user execution, minimal attack surface, and comprehensive health checks.

## Quick Start

```bash
# Build binaries
bun run scripts/build-binaries.ts

# Build and run secure Docker image
docker build -f Dockerfile.alpine -t promptliano:latest .
docker run -d -p 3147:3147 -v promptliano-data:/data promptliano:latest
```

## Docker Image Variants

### 1. Alpine Linux (Recommended for most cases)
- **File**: `Dockerfile.alpine`
- **Size**: ~249MB
- **Use Case**: General production deployment
- **Features**: Small size, good compatibility, non-root user

```bash
docker build -f Dockerfile.alpine -t promptliano:alpine .
```

### 2. Distroless (Maximum security)
- **File**: `Dockerfile.distroless`
- **Size**: ~100MB
- **Use Case**: High-security production environments
- **Features**: No shell, minimal attack surface, non-root by default

```bash
docker build -f Dockerfile.distroless -t promptliano:distroless .
```

### 3. Production 4-Stage Build
- **File**: `Dockerfile.production`
- **Size**: ~100MB (with distroless)
- **Use Case**: CI/CD pipelines, reproducible builds
- **Features**: In-Docker compilation, optimized caching

```bash
docker build -f Dockerfile.production -t promptliano:production .
```

## Security Features

All Docker images include:

✅ **Non-root user execution** (UID 1001)
✅ **Health checks** at `/api/health`
✅ **Minimal base images** (Alpine/Distroless)
✅ **No unnecessary packages** or tools
✅ **Proper file permissions** and ownership
✅ **Environment-based configuration**

## Docker Compose Deployments

### Development
```yaml
docker-compose -f docker-compose.dev.yml up
```

### Production with Binary
```yaml
docker-compose -f docker-compose.binary.yml up -d
```

### Full Production Stack
```yaml
docker-compose -f docker-compose.production.yml up -d
```

## Volume Management

### Data Persistence
```bash
# Create named volume
docker volume create promptliano-data

# Run with volume
docker run -v promptliano-data:/data promptliano:latest

# Backup data
docker run --rm -v promptliano-data:/source -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz -C /source .
```

### Configuration Files
```bash
# Mount config directory
docker run -v ./config:/config:ro promptliano:latest
```

## Environment Variables

Key environment variables (see `.env.example`):

```bash
NODE_ENV=production
SERVER_PORT=3147
DATABASE_PATH=/data/promptliano.db
PROMPTLIANO_DATA_DIR=/data
CORS_ORIGIN=http://localhost:3147
RATE_LIMIT_ENABLED=true
LOG_LEVEL=info
```

## Secret Management

### Using Docker Secrets
```bash
# Create secrets
echo "your-api-key" | docker secret create openai_api_key -
echo "your-secret" | docker secret create jwt_secret -

# Use in compose
docker-compose -f docker-compose.production.yml up
```

### Using Environment Files
```bash
# Create .env.production
cp .env.example .env.production
# Edit with your values

# Run with env file
docker run --env-file .env.production promptliano:latest
```

## Security Scanning

Run security scans before deployment:

```bash
# Using our security scanner
./scripts/docker-security-scan.sh promptliano:latest full

# Using Trivy (recommended)
brew install trivy
trivy image promptliano:latest

# Using Docker Scout
docker scout cves promptliano:latest
```

## Build Optimization

### Binary Pre-compilation
```bash
# Build binaries outside Docker (fastest)
bun run scripts/build-binaries.ts

# Use pre-built binary in Docker
./scripts/docker-binary-build.sh linux-x64
```

### Layer Caching
```bash
# Enable BuildKit for better caching
export DOCKER_BUILDKIT=1
docker build --cache-from promptliano:cache -t promptliano:latest .
```

## Deployment Patterns

### Single Container
```bash
docker run -d \
  --name promptliano \
  --restart unless-stopped \
  -p 3147:3147 \
  -v promptliano-data:/data \
  -e NODE_ENV=production \
  promptliano:production
```

### With Reverse Proxy (Nginx)
```bash
# See docker-compose.production.yml for full setup
docker-compose -f docker-compose.production.yml up -d nginx promptliano
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: promptliano
spec:
  replicas: 2
  selector:
    matchLabels:
      app: promptliano
  template:
    metadata:
      labels:
        app: promptliano
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
      - name: promptliano
        image: promptliano:distroless
        ports:
        - containerPort: 3147
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3147
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3147
```

## Monitoring & Health Checks

### Docker Health Check
```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' promptliano

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' promptliano
```

### Manual Health Check
```bash
curl http://localhost:3147/api/health
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs promptliano

# Run interactively for debugging (Alpine only, distroless has no shell)
docker run -it --rm promptliano:alpine sh
```

### Permission Issues
```bash
# Ensure proper ownership
docker exec promptliano ls -la /data

# Fix permissions if needed
docker exec -u root promptliano chown -R promptliano:promptliano /data
```

### Binary Compatibility
```bash
# For Alpine glibc issues, use the production Dockerfile with in-Docker compilation
docker build -f Dockerfile.production -t promptliano:production .

# This compiles the binary inside Docker, ensuring compatibility
```

## Performance Benchmarks

| Image Type | Size | Startup Time | Memory Usage |
|------------|------|--------------|--------------|
| Alpine | 249MB | ~300ms | 128MB |
| Distroless | 100MB | ~250ms | 96MB |
| Production | 100MB | ~250ms | 96MB |

## Migration from v1 to v2

If migrating from the original Docker setup:

1. **Update Dockerfiles** to include non-root user
2. **Add health checks** to all images
3. **Update volume mounts** to use named volumes
4. **Implement secret management** for API keys
5. **Run security scan** before deployment

## Best Practices

1. **Always run as non-root user** (UID 1001)
2. **Use named volumes** for data persistence
3. **Implement health checks** for orchestration
4. **Scan for vulnerabilities** before deployment
5. **Use distroless** for production when possible
6. **Keep images updated** with latest security patches
7. **Use build cache** for faster builds
8. **Implement proper logging** and monitoring
9. **Use secrets** for sensitive data
10. **Document your deployment** configuration

## Support

For issues or questions:
- Check logs: `docker logs promptliano`
- Run security scan: `./scripts/docker-security-scan.sh`
- Review this documentation
- Open an issue on GitHub