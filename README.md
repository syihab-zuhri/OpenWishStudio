# OpenWishStudio

OpenWishStudio adalah studio berbasis web untuk membuat ucapan interaktif, menyimpannya sebagai draft, lalu membagikannya melalui tautan publik. Aplikasi ini dibangun sebagai monorepo Next.js dengan Supabase sebagai layanan autentikasi, database, dan penyimpanan aset.

Production: <https://openwish-studio.vercel.app>

## Fitur Utama

- Editor visual multi-scene untuk menyusun halaman ucapan interaktif.
- Elemen teks, gambar, bentuk, ikon, tombol, dan kontrol audio.
- Pengaturan posisi, ukuran, rotasi, urutan layer, dan penguncian elemen.
- Background warna, gradient, atau gambar.
- Autosave draft dengan pemeriksaan revision conflict.
- Preview draft sebelum dipublikasikan.
- Draft tamu di browser yang dapat diimpor setelah login.
- Autentikasi email menggunakan Supabase Auth.
- Dashboard untuk membuat, mengganti nama, menduplikasi, dan menghapus kreasi.
- Upload dan pengelolaan aset melalui Supabase Storage.
- Publikasi halaman melalui slug yang dapat dibagikan.
- Opsi masa berlaku publikasi dan kemampuan menarik publikasi.
- API untuk template dan pustaka musik.
- Pelaporan halaman publik dan endpoint moderasi untuk admin.
- Validasi dokumen proyek menggunakan Zod dan migrasi schema version.

## Teknologi

| Bagian                  | Teknologi                             |
| ----------------------- | ------------------------------------- |
| Web application         | Next.js 15, React 19, TypeScript      |
| Styling                 | Tailwind CSS 4                        |
| State management        | Zustand                               |
| Validation              | Zod                                   |
| Backend                 | Next.js App Router dan Route Handlers |
| Database, Auth, Storage | Supabase                              |
| Monorepo                | pnpm workspace dan Turborepo          |
| Testing                 | Vitest dan Testing Library            |
| Code quality            | ESLint, Prettier, Husky, lint-staged  |
| CI/CD                   | GitHub Actions dan Vercel             |

## Struktur Repository

```text
OpenWishStudio/
├── apps/
│   └── web/                    # Aplikasi Next.js
│       └── src/
│           ├── app/            # Halaman, layout, dan API routes
│           ├── features/       # Editor, store, hooks, dan komponen fitur
│           └── lib/            # Supabase client dan helper API
├── packages/
│   ├── config/                 # Konfigurasi ESLint dan Prettier bersama
│   └── project-schema/         # Schema dokumen, tipe database, dan migrasi
├── supabase/
│   ├── migrations/             # Migrasi database
│   └── seed/                   # Data awal pustaka musik
├── .github/workflows/ci.yml    # Pipeline CI
├── package.json                # Script workspace
├── pnpm-workspace.yaml
└── turbo.json
```

## Prasyarat

Pastikan perangkat pengembangan memiliki:

- Node.js 20 atau versi yang lebih baru.
- pnpm 9.
- Akun dan project Supabase.
- Supabase CLI jika ingin menjalankan migrasi atau Supabase lokal.
- Docker jika ingin menjalankan Supabase secara lokal.

Periksa versi yang terpasang:

```powershell
node --version
pnpm.cmd --version
supabase --version
```

## Menjalankan Secara Lokal

### 1. Clone repository

```powershell
git clone https://github.com/syihab-zuhri/OpenWishStudio.git
cd OpenWishStudio
```

### 2. Install dependencies

```powershell
pnpm.cmd install
```

### 3. Siapkan environment variables

Salin template environment ke aplikasi web:

```powershell
Copy-Item .env.example apps/web/.env.local
```

Kemudian isi `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-ref
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=replace-with-a-long-random-secret
```

`SUPABASE_SERVICE_ROLE_KEY` adalah secret server-side. Jangan menambahkan prefix `NEXT_PUBLIC_`, jangan membagikannya, dan jangan memasukkan `.env.local` ke Git.

### 4. Siapkan database Supabase

Untuk menggunakan project Supabase hosted:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
pnpm.cmd db:migrate
```

Untuk menjalankan Supabase lokal:

```powershell
pnpm.cmd db:start
pnpm.cmd db:reset
```

`db:reset` menerapkan migrasi lalu mengisi template lokal secara deterministik
melalui `supabase/seed/local_actor.sql` dan `supabase/seed/templates.sql`.
Seed pustaka musik tidak dijalankan lokal karena objek audio binernya harus
tersedia lebih dahulu di bucket `music-library`.

Gunakan URL dan key yang ditampilkan oleh Supabase CLI untuk mengisi `apps/web/.env.local`.

### 5. Jalankan aplikasi

```powershell
pnpm.cmd dev
```

Buka <http://localhost:3000>.

## Script yang Tersedia

| Perintah                     | Kegunaan                                        |
| ---------------------------- | ----------------------------------------------- |
| `pnpm.cmd dev`               | Menjalankan aplikasi web dalam mode development |
| `pnpm.cmd build`             | Membuat production build                        |
| `pnpm.cmd lint`              | Menjalankan ESLint pada seluruh workspace       |
| `pnpm.cmd typecheck`         | Memeriksa tipe TypeScript                       |
| `pnpm.cmd test`              | Menjalankan seluruh test                        |
| `pnpm.cmd test:unit`         | Menjalankan unit test                           |
| `pnpm.cmd test:integration`  | Menjalankan integration test                    |
| `pnpm.cmd db:start`          | Menyalakan Supabase lokal                       |
| `pnpm.cmd db:stop`           | Mematikan Supabase lokal                        |
| `pnpm.cmd db:migrate`        | Menerapkan migrasi ke project Supabase tertaut  |
| `pnpm.cmd db:reset`          | Membuat ulang database Supabase lokal           |
| `pnpm.cmd db:generate-types` | Membuat ulang tipe TypeScript dari database     |

## Alur Pengembangan

Sebelum membuat commit, jalankan:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Kemudian kirim perubahan ke GitHub:

```powershell
git status
git add .
git commit -m "feat: jelaskan perubahan"
git push origin main
```

Push ke branch `main` akan memicu deployment Production otomatis di Vercel. Pull request dan branch lain dapat digunakan untuk Preview Deployment setelah environment variables Preview dikonfigurasi.

## Deployment Vercel

Project Vercel saat ini menggunakan konfigurasi berikut:

```text
Project         openwish-studio
Framework       Next.js
Root Directory  apps/web
Production      https://openwish-studio.vercel.app
```

Deployment production manual dapat dijalankan dari root repository:

```powershell
vercel.cmd deploy --prod
```

Periksa deployment terbaru:

```powershell
vercel.cmd list openwish-studio
```

Environment variables Production dikelola melalui Vercel, bukan melalui file yang di-commit:

```powershell
vercel.cmd env ls production
vercel.cmd env update NAMA_VARIABEL production
```

Jadwalkan request harian `GET /api/v1/jobs/maintenance` dengan header
`Authorization: Bearer <CRON_SECRET>`. Job ini menandai publikasi kedaluwarsa,
membersihkan upload pending lebih dari 24 jam, dan memangkas counter rate-limit.

Setelah mengubah environment variables, buat deployment baru agar nilainya diterapkan.

## Konfigurasi Supabase Auth

Untuk production, tambahkan konfigurasi berikut pada Supabase Authentication → URL Configuration:

```text
Site URL:
https://openwish-studio.vercel.app

Redirect URLs:
https://openwish-studio.vercel.app/auth/confirm
https://openwish-studio.vercel.app/auth/callback
```

Untuk development lokal, izinkan juga URL `http://localhost:3000/**`.

## API

Route Handlers berada di `apps/web/src/app/api/v1`. Kelompok endpoint yang tersedia meliputi:

- autentikasi dan impor draft tamu;
- CRUD, duplikasi, autosave, dan recovery project;
- validasi, publish, unpublish, serta status publikasi;
- upload dan pengelolaan aset;
- template dan pustaka musik;
- pembacaan dan pelaporan halaman publik;
- moderasi laporan dan halaman oleh admin.

Endpoint menggunakan session Supabase dan Row Level Security. Operasi administratif server-side menggunakan service role key dan harus tetap berada di server.

## CI

GitHub Actions menjalankan pemeriksaan berikut pada push dan pull request ke `main` atau `develop`:

1. Install dependencies dengan lockfile.
2. Lint.
3. Typecheck.
4. Test.
5. Production build.

Konfigurasi pipeline berada di `.github/workflows/ci.yml`.

## Keamanan

- Jangan commit `.env`, `.env.local`, token, atau service role key.
- Gunakan Supabase Row Level Security untuk membatasi akses data per pengguna.
- Gunakan service role key hanya pada server.
- Validasi payload API dan dokumen proyek sebelum disimpan atau dipublikasikan.
- Periksa perubahan dengan `git status` dan `git diff` sebelum commit.

## Repository dan Tautan

- GitHub: <https://github.com/syihab-zuhri/OpenWishStudio>
- Production: <https://openwish-studio.vercel.app>
- Vercel Dashboard: <https://vercel.com/syihabzuhri301004-7150s-projects/openwish-studio>
