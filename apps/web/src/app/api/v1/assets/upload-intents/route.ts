import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { created, serverError, unprocessable, notFound } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

// SVG is deliberately excluded: it carries script and is served from the
// storage origin, where it would execute rather than render as an image.
// The same allow-list is enforced at the bucket level so a client that lies
// about Content-Type on the signed upload cannot get around it.
const ALLOWED_MIMES: Record<'image' | 'audio', string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'],
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
  'audio/aac': 'aac',
}

const MAX_SIZES: Record<'image' | 'audio', number> = {
  image: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
}

const UploadIntentSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().min(1),
  kind: z.enum(['image', 'audio']),
})

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Request tidak valid.')
  }

  const parsed = UploadIntentSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Parameter tidak valid.')
  }

  const { projectId, fileName, size, mime, kind } = parsed.data

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!project) {
    return notFound('Kreasi tidak ditemukan.')
  }

  const allowedMimes = ALLOWED_MIMES[kind]
  if (!allowedMimes.includes(mime)) {
    return unprocessable(`Tipe file ${mime} tidak didukung untuk ${kind}.`)
  }

  if (size > MAX_SIZES[kind]) {
    return unprocessable('Ukuran file melebihi batas maksimum.')
  }

  const assetId = uuidv4()
  // Derived from the validated MIME rather than the filename, which could
  // otherwise inject slashes into the key.
  const ext = EXT_BY_MIME[mime] ?? 'bin'
  const storageKey = `${user!.id}/${projectId}/${assetId}.${ext}`

  const serviceClient = await createSupabaseServiceClient()

  const { error: insertError } = await serviceClient
    .from('assets')
    .insert({
      id: assetId,
      owner_id: user!.id,
      created_by: user!.id,
      project_id: projectId,
      original_name: fileName,
      size_bytes: size,
      mime_type: mime,
      kind,
      storage_key: storageKey,
      source: 'upload',
      checksum_sha256: 'pending',
    })

  if (insertError) {
    console.error('POST /api/v1/assets/upload-intents insert:', insertError.message)
    return serverError()
  }

  const { data: signedData, error: signedError } = await serviceClient.storage
    .from('assets')
    .createSignedUploadUrl(storageKey)

  if (signedError || !signedData) {
    console.error('POST /api/v1/assets/upload-intents signed URL:', signedError?.message)
    await serviceClient.from('assets').delete().eq('id', assetId)
    return serverError()
  }

  return created({
    assetId,
    uploadUrl: signedData.signedUrl,
    headers: { 'Content-Type': mime },
  })
}
