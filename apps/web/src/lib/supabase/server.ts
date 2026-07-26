import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@openwish/project-schema/database.types'

type CookieTuple = { name: string; value: string; options: CookieOptions }

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieTuple[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server component — cookies set in middleware
          }
        },
      },
    },
  )
}

/**
 * Service-role client: bypasses RLS. Never give it request cookies —
 * `createServerClient` forces `persistSession` on and installs a cookie
 * storage adapter, which makes supabase-js send the caller's session JWT as
 * the Bearer token instead of the service key. That silently downgrades this
 * client to the calling user's privileges whenever a session exists.
 *
 * Because this genuinely bypasses RLS, every caller must enforce its own
 * ownership or role check before touching user-scoped rows.
 */
export async function createSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
