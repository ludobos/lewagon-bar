import { NextResponse } from 'next/server'
import { handleCallback } from '@/lib/sumup'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect('/admin/dashboard?sumup=error')
  }

  try {
    await handleCallback(code)
    return NextResponse.redirect('/admin/dashboard?sumup=connected')
  } catch (err: any) {
    console.error('SumUp callback error:', err.message)
    return NextResponse.redirect('/admin/dashboard?sumup=error')
  }
}
