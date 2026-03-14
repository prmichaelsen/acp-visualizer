/**
 * Cloudflare Workers Entry Point
 *
 * Minimal server — passes all requests to TanStack Start.
 * The deployed visualizer uses GitHub remote loading (no local filesystem).
 */

import startServer from '@tanstack/react-start/server-entry'

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const response: Response = await (startServer as any).fetch(request, env, ctx)

    // Prevent stale HTML caching
    const ct = response.headers.get('content-type') || ''
    if (ct.includes('text/html') && !response.headers.has('cache-control')) {
      const patched = new Response(response.body, response)
      patched.headers.set('Cache-Control', 'no-cache')
      return patched
    }

    return response
  },
}
