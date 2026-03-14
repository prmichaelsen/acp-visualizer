# Command: tail

> **🤖 Agent Directive**: If you are reading this file, the command `@tanstack-cloudflare.tail` has been invoked. Follow the steps below to execute this command.

**Namespace**: tanstack-cloudflare
**Version**: 1.0.0
**Created**: 2026-02-21
**Last Updated**: 2026-02-21
**Status**: Active

---

**Purpose**: Stream real-time logs from deployed TanStack Start application on Cloudflare Workers
**Category**: Debugging
**Frequency**: As Needed

---

## What This Command Does

This command streams real-time logs from your deployed TanStack Start application on Cloudflare Workers using Wrangler's tail functionality. It shows console.log statements, errors, and request information as they happen in production.

Use this command when you need to debug production issues, monitor application behavior, or verify that deployed changes are working correctly. It's particularly useful after deployment to confirm everything is functioning as expected.

The command loads environment variables from `.env.cloudflare.local` to authenticate with Cloudflare, then starts streaming logs from your worker.

---

## Prerequisites

- [ ] Node.js and npm installed
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Cloudflare account configured (`wrangler login`)
- [ ] `.env.cloudflare.local` file exists with required variables
- [ ] TanStack Start application deployed to Cloudflare Workers

---

## Steps

### 1. Stream Worker Logs

Export environment variables and start tailing logs in a single command.

**Actions**:
- Export variables from `.env.cloudflare.local`
- Run `wrangler tail` to stream logs
- Watch for console.log statements, errors, and requests
- Press Ctrl+C to stop tailing

**Expected Outcome**: Real-time logs streaming from deployed worker

**Example**:
```bash
export $(cat .env.cloudflare.local | xargs) && wrangler tail
```

**Note**: This command will run continuously until you stop it with Ctrl+C. The logs will show all console.log, console.error, and console.warn statements from your worker, plus request information.

### 2. Monitor Logs

Watch the streaming logs for relevant information.

**Actions**:
- Look for console.log statements from your code
- Watch for errors or warnings
- Monitor request patterns
- Check SSR rendering logs
- Observe API route handling
- Monitor beforeLoad execution

**Expected Outcome**: Real-time visibility into worker behavior

### 3. Stop Tailing

Stop the log stream when done.

**Actions**:
- Press Ctrl+C to stop tailing
- Logs stop streaming

**Expected Outcome**: Command exits cleanly

---

## Verification

- [ ] Environment variables loaded successfully
- [ ] Wrangler tail started without errors
- [ ] Logs are streaming in real-time
- [ ] Can see console.log statements from worker
- [ ] Can see SSR rendering logs
- [ ] Can see API route logs
- [ ] Can stop tailing with Ctrl+C

---

## Expected Output

### Files Modified
None - this is a read-only monitoring command

### Console Output
```
 ⛅️ wrangler 4.x.x
─────────────────────────────────────────────
Tailing logs for your-app...

[2026-02-21 05:20:00] GET https://your-app.workers.dev/
[2026-02-21 05:20:00] [SSR] Rendering route: /
[2026-02-21 05:20:00] [beforeLoad] Fetching user session
[2026-02-21 05:20:01] [DatabaseService] getUserData: user123
[2026-02-21 05:20:01] [SSR] Route rendered successfully
[2026-02-21 05:20:05] GET https://your-app.workers.dev/api/data
[2026-02-21 05:20:05] [API] /api/data - Processing request
[2026-02-21 05:20:05] [DatabaseService] Query completed in 45ms
[2026-02-21 05:20:05] [API] /api/data - Response sent (200)

^C (Press Ctrl+C to stop)
```

### Status Update
- Monitoring production logs in real-time
- Can see all console.log/error/warn statements
- Can observe request patterns and performance
- Can debug SSR issues
- Can monitor API route behavior

---

## Examples

### Example 1: Debug SSR Issue

**Context**: Users reporting blank pages, need to see SSR rendering logs

**Invocation**: `@tanstack-cloudflare.tail`

**Result**: Stream logs, see SSR errors, identify which route is failing

### Example 2: Verify Deployment

**Context**: Just deployed new feature, want to confirm it's working

**Invocation**: `@tanstack-cloudflare.tail`

**Result**: Watch logs as you test the feature, see console.log statements confirming behavior

### Example 3: Monitor API Performance

**Context**: Want to see how long database queries take in production

**Invocation**: `@tanstack-cloudflare.tail`

**Result**: See timing logs from database services, identify slow queries

### Example 4: Debug beforeLoad Issues

**Context**: Data not loading on SSR, need to see beforeLoad execution

**Invocation**: `@tanstack-cloudflare.tail`

**Result**: See beforeLoad logs, identify data fetching issues

---

## Related Commands

- [`@tanstack-cloudflare.deploy`](tanstack-cloudflare.deploy.md) - Deploy before tailing logs
- [`@git.commit`](git.commit.md) - Commit changes before deploying

---

## Troubleshooting

### Issue 1: Environment file not found

**Symptom**: Error "No such file or directory: .env.cloudflare.local"

**Cause**: `.env.cloudflare.local` file doesn't exist

**Solution**: Create `.env.cloudflare.local` file with required Cloudflare variables. Copy from `.env.example` if available.

### Issue 2: Wrangler authentication error

**Symptom**: "Not authenticated" or "Invalid API token"

**Cause**: Not logged in to Wrangler or token expired

**Solution**: Run `wrangler login` to authenticate with Cloudflare account

### Issue 3: No logs appearing

**Symptom**: Tail starts but no logs show up

**Cause**: No requests being made to worker, or console.log statements removed

**Solution**: Make requests to your worker (visit the URL, send API requests), or add console.log statements to your code

### Issue 4: Too many logs

**Symptom**: Logs scrolling too fast to read

**Cause**: High traffic or verbose logging

**Solution**: 
- Use `wrangler tail --format pretty` for better formatting
- Filter logs with grep: `export $(cat .env.cloudflare.local | xargs) && wrangler tail | grep "ERROR"`
- Reduce console.log verbosity in code
- Filter by specific service: `wrangler tail | grep "DatabaseService"`

### Issue 5: Can't stop tailing

**Symptom**: Ctrl+C doesn't stop the command

**Cause**: Terminal not responding to interrupt signal

**Solution**: Close the terminal tab, or use `kill` command from another terminal

### Issue 6: SSR logs not showing

**Symptom**: Only seeing client-side logs

**Cause**: SSR console.log statements may be filtered or not present

**Solution**: Add explicit console.log statements in beforeLoad and server-side code to verify SSR execution

---

## Security Considerations

### File Access
- **Reads**: `.env.cloudflare.local`
- **Writes**: None
- **Executes**: `wrangler tail`

### Network Access
- **APIs**: Cloudflare API (for log streaming)
- **Repositories**: None

### Sensitive Data
- **Secrets**: Sources `.env.cloudflare.local` which may contain API tokens
- **Credentials**: Wrangler uses stored Cloudflare credentials
- **⚠️ Warning**: Logs may contain sensitive data (user IDs, API responses) - be careful when sharing logs
- **⚠️ Warning**: Never commit logs to version control
- **⚠️ Warning**: Avoid logging sensitive user data (passwords, tokens, PII)

---

## Notes

- This command runs continuously until stopped with Ctrl+C
- Logs are streamed in real-time (not historical)
- Only shows logs from the current moment forward
- For historical logs, use Cloudflare dashboard
- Logs include console.log, console.error, console.warn from your worker
- Also shows request information (method, URL, status code)
- Useful for debugging production issues
- Can be combined with grep to filter specific logs
- Environment variables must be exported in the same command (using `&&`)
- TanStack Start logs both SSR (server) and client-side code
- beforeLoad executes on server, so logs appear in tail
- API routes execute on server, so logs appear in tail
- Client-side useEffect logs won't appear (only server-side)

---

**Namespace**: tanstack-cloudflare
**Command**: tail
**Version**: 1.0.0
**Created**: 2026-02-21
**Last Updated**: 2026-02-21
**Status**: Active
**Compatibility**: TanStack Start, Cloudflare Workers, Wrangler 3.x+
**Author**: Patrick Michaelsen
