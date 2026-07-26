import { z } from 'zod'
import { type NextRequest } from 'next/server'
import { ok, serverError, unprocessable } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const RandomSchema = z.object({
  categories: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(20).default(5),
})

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = RandomSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Parameter tidak valid.')
  }

  const { categories, count } = parsed.data

  let query = supabase
    .from('templates')
    .select('id, slug, name, category, thumbnail_url, schema_version')
    .eq('status', 'published' as never)
    .limit(count)

  if (categories && categories.length > 0) {
    query = query.in('category', categories)
  }

  const { data, error } = await query

  if (error) {
    console.error('POST /api/v1/templates/random:', error.message)
    return serverError()
  }

  return ok({ templates: data })
}
