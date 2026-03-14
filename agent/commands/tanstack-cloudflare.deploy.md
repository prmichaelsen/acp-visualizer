# Command: deploy

> **🤖 Agent Directive**: If you are reading this file, the command `@tanstack-cloudflare.deploy` has been invoked. Follow the steps below to execute this command.

**Namespace**: tanstack-cloudflare
**Version**: 1.0.0
**Created**: 2026-02-21
**Last Updated**: 2026-02-21
**Status**: Active

---

**Purpose**: Build and deploy TanStack Start application to Cloudflare Workers using local environment configuration
**Category**: Workflow
**Frequency**: As Needed

---

## What This Command Does

This command performs a complete build and deployment cycle for TanStack Start applications to Cloudflare Workers. It builds the application using Vite, sources the local Cloudflare environment variables, and deploys using Wrangler CLI.

Use this command when you want to deploy changes to your Cloudflare Workers environment. It's particularly useful during development when you need to test changes in the actual Cloudflare environment rather than local development.

The command ensures that the correct environment variables are loaded from `.env.cloudflare.local` before deployment, preventing accidental use of wrong credentials or configuration.

---

## Prerequisites

- [ ] Node.js and npm installed
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Cloudflare account configured (`wrangler login`)
- [ ] `.env.cloudflare.local` file exists with required variables
- [ ] Application code is ready to deploy (no syntax errors)
- [ ] TanStack Start project properly configured

---

## Steps

### 1. Build Application

Build the application for production using Vite.

**Actions**:
- Run `npm run build`
- Wait for build to complete
- Verify no build errors

**Expected Outcome**: Build completes successfully, `dist/` directory created

**Example**:
```bash
npm run build
```

### 2. Deploy to Cloudflare Workers

Export environment variables and deploy in a single command.

**Actions**:
- Export variables from `.env.cloudflare.local` and run `wrangler deploy` in one command
- Environment variables loaded and immediately used for deployment
- Wait for deployment to complete
- Verify deployment success
- Note the deployed URL

**Expected Outcome**: Application deployed successfully to Cloudflare Workers

**Example**:
```bash
export $(cat .env.cloudflare.local | xargs) && wrangler deploy
```

**Note**: This command reads the env file, exports all variables, and runs wrangler in the same shell session. The `&&` ensures wrangler only runs if export succeeds.

### 3. Verify Deployment

Confirm the deployment was successful.

**Actions**:
- Check wrangler output for deployment URL
- Verify no deployment errors
- Note the worker version/deployment ID

**Expected Outcome**: Deployment URL displayed, no errors

---

## Verification

- [ ] Build completed without errors
- [ ] Environment variables sourced successfully
- [ ] Wrangler deployment completed
- [ ] Deployment URL displayed
- [ ] No error messages in output
- [ ] Application accessible at deployment URL

---

## Expected Output

### Files Modified
None - this is a deployment command (reads files, doesn't modify them)

### Console Output
```
> build
> vite build

vite v7.3.1 building client environment for production...
✓ 2126 modules transformed.
✓ built in 6.60s

vite v7.3.1 building ssr environment for production...
✓ 5861 modules transformed.
✓ built in 12.07s

 ⛅️ wrangler 3.x.x
-------------------
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded your-app (x.xx sec)
Published your-app (x.xx sec)
  https://your-app.your-subdomain.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Status Update
- Application built successfully
- Deployed to Cloudflare Workers
- Accessible at deployment URL

---

## Examples

### Example 1: Deploy After Feature Implementation

**Context**: Just completed implementing a new feature and want to test in production

**Invocation**: `@tanstack-cloudflare.deploy`

**Result**: Application builds, environment variables loaded, deployed to Cloudflare Workers, deployment URL displayed

### Example 2: Deploy After Bug Fix

**Context**: Fixed a critical bug and need to deploy immediately

**Invocation**: `@tanstack-cloudflare.deploy`

**Result**: Quick build and deployment cycle, bug fix live in production

### Example 3: Deploy for Testing

**Context**: Need to test WebSocket functionality in actual Cloudflare environment

**Invocation**: `@tanstack-cloudflare.deploy`

**Result**: Application deployed with latest changes, can test real-world behavior

---

## Related Commands

- [`@git.commit`](git.commit.md) - Commit changes before deploying
- [`@acp.status`](acp.status.md) - Check project status before deploying

---

## Troubleshooting

### Issue 1: Build fails with TypeScript errors

**Symptom**: `npm run build` fails with TypeScript compilation errors

**Cause**: Type errors in source code

**Solution**: Fix TypeScript errors before deploying. Run `npm run typecheck` to see all errors.

### Issue 2: Environment file not found

**Symptom**: Error "No such file or directory: .env.cloudflare.local"

**Cause**: `.env.cloudflare.local` file doesn't exist

**Solution**: Create `.env.cloudflare.local` file with required Cloudflare variables. Copy from `.env.example` if available.

### Issue 3: Wrangler authentication error

**Symptom**: "Not authenticated" or "Invalid API token"

**Cause**: Not logged in to Wrangler or token expired

**Solution**: Run `wrangler login` to authenticate with Cloudflare account

### Issue 4: Deployment fails with "Script too large"

**Symptom**: Error about worker script size exceeding limits

**Cause**: Bundle size too large for Cloudflare Workers free tier

**Solution**: 
- Optimize bundle size with code splitting
- Remove unused dependencies
- Consider upgrading to Workers Paid plan
- Use dynamic imports for large dependencies

### Issue 5: Environment variables not loaded

**Symptom**: Deployment succeeds but application doesn't work correctly

**Cause**: Environment variables not properly sourced or wrong file used

**Solution**: Verify `.env.cloudflare.local` exists and contains correct variables. Ensure you're using `export $(cat .env.cloudflare.local | xargs) && wrangler deploy` (single command with &&).

### Issue 6: TanStack Start build errors

**Symptom**: Build fails with TanStack-specific errors

**Cause**: Misconfigured TanStack Start project or incompatible dependencies

**Solution**: 
- Check `app.config.ts` is properly configured
- Verify `@tanstack/start` version compatibility
- Review TanStack Start documentation for breaking changes

---

## Security Considerations

### File Access
- **Reads**: All source files in `src/`, `dist/` directory after build, `.env.cloudflare.local`
- **Writes**: `dist/` directory (build output)
- **Executes**: `npm run build`, `wrangler deploy`

### Network Access
- **APIs**: Cloudflare API (for deployment)
- **Repositories**: None

### Sensitive Data
- **Secrets**: Sources `.env.cloudflare.local` which may contain API tokens
- **Credentials**: Wrangler uses stored Cloudflare credentials
- **⚠️ Warning**: Never commit `.env.cloudflare.local` to version control
- **⚠️ Warning**: Ensure `.env.cloudflare.local` is in `.gitignore`

---

## Notes

- This command is for local development/testing deployments
- For production deployments, use CI/CD pipeline
- Always test locally before deploying (`npm run dev`)
- Deployment typically takes 15-30 seconds
- Old deployments are automatically replaced (not versioned)
- Use `wrangler deployments list` to see deployment history
- Use `wrangler rollback` to revert to previous deployment if needed
- The environment variables must be sourced in the same command as wrangler deploy (using `&&`)
- If deployment fails, check wrangler logs with `wrangler tail`
- TanStack Start builds both client and SSR bundles - both are deployed
- Cloudflare Workers have a 1MB compressed size limit for free tier

---

**Namespace**: tanstack-cloudflare
**Command**: deploy
**Version**: 1.0.0
**Created**: 2026-02-21
**Last Updated**: 2026-02-21
**Status**: Active
**Compatibility**: TanStack Start, Cloudflare Workers, Wrangler 3.x+
**Author**: Patrick Michaelsen
