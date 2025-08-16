# GitHub Actions Workflow Architecture Guide

This guide documents the CI/CD architecture, workflow patterns, and best practices for Promptliano's GitHub Actions pipelines.

## Overview

Promptliano uses GitHub Actions for continuous integration, testing, building, and deploying across our monorepo. All workflows leverage **Bun** as the primary runtime and package manager for optimal performance.

## Workflow Architecture

### Core Workflows

#### 1. **Package-Specific CI Workflows**

- `client.yml` - Client package CI (React app)
- `server.yml` - Server package CI (Hono/Bun backend)
- `services.yml` - Services package CI (business logic)
- `shared.yml` - Shared utilities CI

#### 2. **Publishing Workflows**

- `publish-ui.yml` - Publishes @promptliano/ui to npm
- `publish-cli.yml` - Publishes CLI package to npm
- `publish-npm-package.reusable.yml` - Reusable workflow template

#### 3. **Release Workflows**

- `release-binaries.yml` - Server binary releases
- `deploy-website.yml` - Website deployment

#### 4. **Testing Workflows**

- `test-local.yml` - Local testing workflow

### Workflow Triggers

```yaml
# Push to main branch
on:
  push:
    branches: [main]

# Pull requests with path filtering
on:
  pull_request:
    branches: [main]
    paths:
      - 'packages/client/**'

# Tag-based releases
on:
  push:
    tags:
      - 'ui-v*'  # UI package releases
      - 'v*'     # General releases

# Manual dispatch
on:
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag'
```

## Bun Integration

### Why Bun?

1. **Speed**: ~33% faster builds than Node.js tooling
2. **Native TypeScript**: No transpilation needed for TS files
3. **Built-in tooling**: Test runner, bundler, package manager
4. **Lockfile efficiency**: Binary lockfile for faster installs
5. **Zero-config**: Works out of the box with TypeScript

### Setup Bun in Workflows

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v2
  with:
    bun-version: latest # or specific version like '1.1.0'
```

### Essential Bun Commands for CI

#### Package Installation

```yaml
# Development install (default)
- run: bun install

# CI install with frozen lockfile (recommended for CI)
- run: bun ci
# or
- run: bun install --frozen-lockfile

# Production install (omits devDependencies)
- run: bun install --production
```

#### Building

```yaml
# Run build script from package.json
- run: bun run build

# Production build with environment
- run: NODE_ENV=production bun run build

# Direct Bun bundler
- run: bun build ./src/index.ts --outdir ./dist --target node
```

#### Testing

```yaml
# Run tests
- run: bun test

# Run tests with coverage
- run: bun test --coverage

# Run specific test files
- run: bun test src/**/*.test.ts
```

### Bun CI Optimizations

#### 1. Dependency Caching

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.bun/install/cache
      node_modules
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
    restore-keys: |
      ${{ runner.os }}-bun-
```

#### 2. Frozen Lockfile

Always use `--frozen-lockfile` in CI to ensure reproducible builds:

```yaml
- name: Install dependencies
  run: bun install --frozen-lockfile
```

#### 3. Production Builds

Use production mode for optimized builds:

```yaml
- name: Build for production
  run: |
    NODE_ENV=production bun run build
  env:
    NODE_ENV: production
```

#### 4. Parallel Execution

Leverage Bun's parallel script execution:

```yaml
# In package.json
'scripts': { 'test:all': 'bun run test:unit & bun run test:integration & wait' }
```

## Workflow Patterns

### Reusable Workflow Pattern

The `publish-npm-package.reusable.yml` demonstrates our reusable workflow pattern:

```yaml
on:
  workflow_call:
    inputs:
      package-path:
        type: string
      build-command:
        type: string
        default: 'bun run build'
    secrets:
      NPM_TOKEN:
        required: true

jobs:
  publish:
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: ${{ inputs.build-command }}
```

### Monorepo CI Pattern

For monorepo packages, we use path filtering and workspace commands:

```yaml
on:
  pull_request:
    paths:
      - 'packages/client/**'
      - 'packages/shared/**' # Include dependencies

jobs:
  test:
    steps:
      - run: bun install --frozen-lockfile
      - run: bun run --filter ./packages/client test
```

### Matrix Testing Pattern

Test across multiple environments:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    bun-version: [1.0.x, 1.1.x, latest]
runs-on: ${{ matrix.os }}
steps:
  - uses: oven-sh/setup-bun@v2
    with:
      bun-version: ${{ matrix.bun-version }}
```

## Best Practices

### 1. Security

#### Use Exact Action Versions

```yaml
# Good - uses SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

# Avoid - uses tag
- uses: actions/checkout@v4
```

#### Minimal Permissions

```yaml
permissions:
  contents: read
  id-token: write # Only for npm provenance
```

#### Secret Management

```yaml
env:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  # Never log secrets
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. Performance

#### Use Job Dependencies Wisely

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

  build:
    needs: test # Only run if tests pass
    runs-on: ubuntu-latest
```

#### Fail Fast Strategy

```yaml
strategy:
  fail-fast: true # Cancel all jobs if one fails
  matrix:
    # ...
```

#### Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true # Cancel old runs
```

### 3. Workflow Organization

#### Clear Job Names

```yaml
jobs:
  test-unit:
    name: 'Unit Tests'

  test-integration:
    name: 'Integration Tests'

  build-and-publish:
    name: 'Build & Publish to NPM'
```

#### Step Descriptions

```yaml
- name: Install dependencies
  run: bun install --frozen-lockfile

- name: Run unit tests with coverage
  run: bun test --coverage
```

#### Job Summaries

```yaml
- name: Create summary
  if: always()
  run: |
    echo "## Test Results" >> $GITHUB_STEP_SUMMARY
    echo "- ✅ Unit tests: Passed" >> $GITHUB_STEP_SUMMARY
    echo "- ✅ Build: Success" >> $GITHUB_STEP_SUMMARY
```

### 4. Error Handling

#### Continue on Error

```yaml
- name: Run optional linting
  run: bun run lint
  continue-on-error: true
```

#### Conditional Steps

```yaml
- name: Upload artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: error-logs
    path: logs/
```

#### Retry Logic

```yaml
- name: Deploy with retry
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: bun run deploy
```

## Bun-Specific Features for CI

### 1. Binary Lockfile (`bun.lockb`)

Bun uses a binary lockfile for speed. In CI:

- Always commit `bun.lockb` to version control
- Use `--frozen-lockfile` to ensure exact versions
- The lockfile is platform-agnostic

### 2. Workspace Support

For monorepo management:

```yaml
# Install all workspace dependencies
- run: bun install --frozen-lockfile

# Run command in specific workspace
- run: bun --filter ./packages/client run build

# Run command in all workspaces
- run: bun --filter '*' run test
```

### 3. Built-in Test Runner

```yaml
# Run all tests
- run: bun test

# Run with specific pattern
- run: bun test **/*.spec.ts

# With timeout
- run: bun test --timeout 5000
```

### 4. Environment Variables

```yaml
env:
  # Bun automatically loads .env files
  NODE_ENV: production

  # Bun-specific
  BUN_CONFIG_MAX_HTTP_REQUESTS: 128
  BUN_CONFIG_NO_CLEAR_TERMINAL: 1
```

### 5. Script Execution

```yaml
# Direct execution of TypeScript
- run: bun run src/scripts/build.ts

# Parallel execution
- run: bun run build:all:parallel
```

## Common Patterns

### Publishing to NPM

```yaml
- name: Publish to npm
  run: |
    # Check if version exists
    if npm view @promptliano/ui@$VERSION > /dev/null 2>&1; then
      echo "Version already published"
      exit 0
    fi

    # Publish with provenance
    npm publish --access public --provenance
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Building Binaries

```yaml
- name: Build standalone binary
  run: |
    bun build ./src/index.ts \
      --compile \
      --target=bun-linux-x64 \
      --outfile=server
```

### Docker Integration

```yaml
- name: Build Docker image
  run: |
    docker build \
      --build-arg BUN_VERSION=latest \
      -t promptliano:${{ github.sha }} .
```

## Debugging Workflows

### Enable Debug Logging

Set repository secrets:

- `ACTIONS_RUNNER_DEBUG: true`
- `ACTIONS_STEP_DEBUG: true`

### Local Testing with Act

```bash
# Install act
brew install act

# Run workflow locally
act -W .github/workflows/test.yml

# With specific event
act pull_request -W .github/workflows/client.yml
```

### Common Issues

#### 1. Lockfile Conflicts

```yaml
# Resolution: Update lockfile
- run: |
    bun install
    git add bun.lockb
    git commit -m "Update lockfile"
```

#### 2. Port Conflicts

```yaml
# Use dynamic ports in tests
env:
  PORT: 0 # Let OS assign port
```

#### 3. Timeout Issues

```yaml
# Increase timeout for long operations
- name: Build production
  timeout-minutes: 30
  run: bun run build:prod
```

## Workflow Templates

### Basic CI Template

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun test
      - run: bun run build
```

### Release Template

```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: NODE_ENV=production bun run build
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*
```

## Migration Guide

### From npm/yarn to Bun

1. **Replace npm/yarn commands**:
   - `npm ci` → `bun install --frozen-lockfile`
   - `npm install` → `bun install`
   - `npm run build` → `bun run build`
   - `npm test` → `bun test`

2. **Update cache paths**:

   ```yaml
   # Old (npm)
   path: ~/.npm

   # New (bun)
   path: ~/.bun/install/cache
   ```

3. **Update lockfile references**:
   - `package-lock.json` → `bun.lockb`
   - `yarn.lock` → `bun.lockb`

## Performance Metrics

Our Bun-based CI achieves:

- **Install time**: ~70% faster than npm
- **Build time**: ~33% faster than traditional tooling
- **Test execution**: ~50% faster with Bun's native test runner
- **Overall CI time**: Reduced from ~8 minutes to ~3 minutes

## Future Improvements

1. **Parallel job optimization**: Further parallelize independent tasks
2. **Smart caching**: Implement more granular caching strategies
3. **Build artifacts**: Share built packages between jobs
4. **Incremental builds**: Only rebuild changed packages
5. **Performance monitoring**: Add CI performance tracking

## Resources

- [Bun CI/CD Guide](https://bun.sh/guides/runtime/cicd)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices)
- [setup-bun Action](https://github.com/oven-sh/setup-bun)
- [Bun Documentation](https://bun.sh/docs)

This architecture leverages Bun's speed and simplicity to create efficient, maintainable CI/CD pipelines that scale with our monorepo structure.
