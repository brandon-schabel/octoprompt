# Deployment Rollback Procedure

This document outlines the rollback procedure for the Promptliano website deployed on GitHub Pages.

## Automatic Rollback via GitHub Actions

### Method 1: Revert Recent Deployment (Recommended)

1. Navigate to the [GitHub Actions page](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml)
2. Find the last successful deployment before the problematic one
3. Click on the workflow run
4. Click "Re-run all jobs" to redeploy the previous version

### Method 2: Git Revert

1. Identify the commit that caused the issue:

   ```bash
   git log --oneline packages/website/
   ```

2. Create a revert commit:

   ```bash
   git revert <problematic-commit-hash>
   ```

3. Push to main branch:
   ```bash
   git push origin main
   ```

The GitHub Actions workflow will automatically trigger and deploy the reverted version.

## Manual Rollback via GitHub Pages

### Emergency Rollback

If GitHub Actions is not available:

1. Go to repository Settings → Pages
2. Under "Source", change from "GitHub Actions" to "Deploy from a branch"
3. Select the `gh-pages` branch
4. Click "Save"

This will serve the last successfully deployed version from the `gh-pages` branch.

### Rollback to Specific Version

1. Download the build artifact from a previous successful deployment:
   - Go to [Actions](https://github.com/brandon-schabel/promptliano/actions)
   - Find the successful deployment
   - Download the `website-build-<sha>` artifact

2. Manually deploy to gh-pages:
   ```bash
   git checkout gh-pages
   rm -rf *
   unzip website-build-<sha>.zip
   git add .
   git commit -m "Rollback to version <sha>"
   git push origin gh-pages
   ```

## Rollback Verification

After rolling back:

1. Check the deployment status:
   - Visit https://promptliano.com
   - Verify the site is accessible
   - Check critical pages (/docs, /integrations)

2. Monitor the deployment:
   - Check [GitHub Actions](https://github.com/brandon-schabel/promptliano/actions) for deployment status
   - Review Lighthouse CI results in the workflow

3. Verify functionality:
   - Test navigation
   - Check asset loading
   - Verify API integrations if any

## Prevention Measures

To minimize the need for rollbacks:

1. **Use PR Preview Deployments**: Always test changes in PR previews before merging
2. **Run Local Builds**: Test `bun run build:website` locally before pushing
3. **Monitor CI/CD**: Watch for build warnings and errors
4. **Use Feature Flags**: For major changes, consider using feature flags

## Recovery Timeline

- **Automatic rollback via re-run**: ~2-3 minutes
- **Git revert method**: ~5 minutes
- **Manual gh-pages update**: ~10 minutes
- **Emergency branch switch**: Immediate

## Contact

For deployment issues, contact the maintainers or create an issue in the repository.
