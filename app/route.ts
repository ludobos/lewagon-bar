import { readFileSync } from 'fs'
import { join } from 'path'

const html = readFileSync(join(process.cwd(), 'public', 'landing.html'), 'utf-8')

export async function GET() {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
