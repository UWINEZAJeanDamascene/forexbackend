import { defineConfig } from 'prisma/config'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

function loadEnvFile(): void {
  const rootEnvPath = path.resolve(__dirname, '../.env')
  const localEnvPath = path.resolve(__dirname, '.env')

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath })
  } else if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath })
  } else {
    dotenv.config()
  }
}

loadEnvFile()

function cleanDatabaseUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.searchParams.has('channel_binding')) {
      u.searchParams.delete('channel_binding')
    }
    return u.toString()
  } catch {
    return url
  }
}

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: cleanDatabaseUrl(process.env.DATABASE_URL || ''),
  },
})
