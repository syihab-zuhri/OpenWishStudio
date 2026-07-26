#!/usr/bin/env node
/**
 * Regenerates packages/project-schema/src/database.types.ts.
 *
 * This exists instead of a plain `supabase gen types ... > file` because the
 * shell truncates the target *before* running the command: any failure — the
 * CLI missing from PATH, a network blip, an auth prompt — leaves an empty file
 * behind and breaks the whole typecheck. Here the output is captured, sanity
 * checked, and only then written.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(repoRoot, 'packages/project-schema/src/database.types.ts')
const projectId = process.env.SUPABASE_PROJECT_ID ?? 'qoqtfnajpwpwgtqlousl'

// Launching npx needs a shell on Windows (spawning a .cmd directly fails with
// EINVAL), and with `shell: true` Node concatenates arguments instead of
// escaping them. Since SUPABASE_PROJECT_ID comes from the environment, the
// answer is to validate it rather than to trust escaping: a Supabase project
// ref is always lowercase alphanumerics.
if (!/^[a-z0-9]{16,32}$/.test(projectId)) {
  console.error(`Refusing to run: SUPABASE_PROJECT_ID is not a valid project ref: ${projectId}`)
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
  { encoding: 'utf8', shell: true, cwd: repoRoot },
)

if (result.error) {
  console.error('Failed to run the Supabase CLI:', result.error.message)
  process.exit(1)
}

// The CLI mixes its own diagnostics into stdout — a PostHog shutdown timeout
// lands *after* the generated module and turns the file into a syntax error.
// Anything that looks like one of those JSON blobs is dropped.
const output =
  (result.stdout ?? '')
    .split('\n')
    .filter((line) => !/^\s*\{"_tag":/.test(line))
    .join('\n')
    .trimEnd() + '\n'

// The CLI also exits non-zero for benign config warnings, so the exit code
// alone is not a reliable signal. Judge the payload instead.
if (!output.includes('export type Database')) {
  console.error('Supabase CLI produced no usable type output. Nothing was written.')
  if (result.stderr) console.error(result.stderr.trim())
  process.exit(1)
}

writeFileSync(target, output, 'utf8')
console.error(`Wrote ${target} (${output.split('\n').length} lines).`)
