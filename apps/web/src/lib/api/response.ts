import { NextResponse } from 'next/server'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function notFound(message = 'Kreasi tidak ditemukan.') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export function forbidden(message = 'Akses ditolak.') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function unprocessable(message: string) {
  return NextResponse.json({ error: message }, { status: 422 })
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function serverError(message = 'Terjadi kesalahan server.') {
  return NextResponse.json({ error: message }, { status: 500 })
}
