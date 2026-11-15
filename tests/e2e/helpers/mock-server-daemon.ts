import { E2E_MOCK_PORT } from "./env"
import { startE2eMockServer } from "./mock-servers"

async function main(): Promise<void> {
  const server = await startE2eMockServer(E2E_MOCK_PORT)
  process.stdout.write(
    `[e2e-mock-server] listening on http://127.0.0.1:${E2E_MOCK_PORT}\n`
  )

  const shutdown = () => {
    server.close(() => {
      process.exit(0)
    })
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

void main()
