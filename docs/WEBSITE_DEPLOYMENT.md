# Promptliano Website Deployment Guide

This guide covers the deployment process for the Promptliano marketing website to GitHub Pages.

## Overview

The Promptliano website is automatically deployed to [promptliano.com](https://promptliano.com) using GitHub Actions whenever changes are pushed to the `main` branch.

## Deployment Pipeline

### Automatic Deployment

1. **Trigger**: Push to `main` branch with changes in `packages/website/`
2. **Build**: GitHub Actions builds the website using Bun
3. **Deploy**: Built artifacts are deployed to GitHub Pages
4. **Validate**: Post-deployment checks ensure site availability

### Preview Deployments

Pull requests automatically receive preview deployments:

- URL format: `https://brandon-schabel.github.io/promptliano/pr-preview/pr-{number}`
- Updated on each push to the PR
- Automatically cleaned up when PR is closed

## Configuration

### Environment Variables

The deployment uses these environment variables:

- `NODE_ENV`: Set to `production` during builds
- `VITE_BASE_URL`: Base path for assets (automatically configured)

### Build Optimization

The build process includes:

- Terser minification
- Console/debugger stripping in production
- Code splitting for optimal loading
- Manual chunks for better caching

### Custom Domain

The website is configured to use `promptliano.com`:

- CNAME file in `public/` directory
- DNS configuration required (see below)

## Local Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev:website

# Build locally
bun run build:website

# Preview production build
cd packages/website && bun run preview
```

## Deployment Process

### Manual Deployment

While automatic deployment is preferred, you can trigger manually:

1. Go to [Actions](https://github.com/brandon-schabel/promptliano/actions)
2. Select "Deploy Website to GitHub Pages"
3. Click "Run workflow"
4. Select the branch (usually `main`)
5. Click "Run workflow"

### Deployment Status

Monitor deployment status:

- GitHub Actions: Check workflow runs
- Status Badge: See README.md
- Website: Visit [promptliano.com](https://promptliano.com)

## DNS Configuration

For custom domain setup:

1. **A Records** (if using apex domain):

   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

2. **CNAME Record** (if using subdomain):

   ```
   CNAME -> brandon-schabel.github.io
   ```

3. **Verification**:
   ```bash
   dig promptliano.com
   nslookup promptliano.com
   ```

## Troubleshooting

### Build Failures

1. Check GitHub Actions logs
2. Run build locally: `bun run build:website`
3. Verify dependencies: `bun install`

### Deployment Issues

1. Verify GitHub Pages is enabled in repository settings
2. Check CNAME file exists in `public/`
3. Ensure `gh-pages` branch permissions

### Domain Issues

1. Verify DNS propagation (can take up to 48 hours)
2. Check HTTPS certificate generation
3. Clear browser cache

## Performance Monitoring

Post-deployment validation includes:

- Lighthouse CI performance checks
- Availability monitoring
- Critical path validation

Results are available in GitHub Actions artifacts.

## Security

- Dependabot monitors for security updates
- Build process uses lockfile for reproducible builds
- Secrets and API keys should never be committed

## Rollback Procedure

See [DEPLOYMENT_ROLLBACK.md](./DEPLOYMENT_ROLLBACK.md) for detailed rollback instructions.

## Best Practices

1. **Test Locally**: Always build locally before pushing
2. **Use PR Previews**: Test changes in PR preview before merging
3. **Monitor Deployments**: Check GitHub Actions for build status
4. **Version Control**: Tag releases for easy rollback
5. **Performance**: Monitor Lighthouse scores

## Support

For deployment issues:

1. Check GitHub Actions logs
2. Review this documentation
3. Create an issue in the repository
