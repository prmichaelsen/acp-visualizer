import { createFileRoute } from '@tanstack/react-router'
import { getFileWatcher } from '../../lib/file-watcher'

export const Route = createFileRoute('/api/watch')({
  server: {
    handlers: {
      GET: async () => {
        const watcher = getFileWatcher()

        const stream = new ReadableStream({
          start(controller) {
            watcher.addClient(controller)
          },
          cancel(controller) {
            watcher.removeClient(controller)
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      },
    },
  },
})
