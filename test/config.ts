import { fileURLToPath } from 'node:url'

export const reactTestConfig = {
  setupFiles: [fileURLToPath(new URL('./setup.ts', import.meta.url))],
}
