import { closeE2eDb } from "./helpers/db"

export default async function globalTeardown(): Promise<void> {
  await closeE2eDb()
}
