import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-base font-bold tracking-tight text-neutral-900">
          OpenWish<span className="text-brand-500">Studio</span>
        </Link>
        <nav className="hidden items-center gap-6 sm:flex">
          <a href="#fitur" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
            Fitur
          </a>
          <a href="#cara-kerja" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
            Cara Kerja
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="rounded-full px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            Masuk
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Mulai Gratis
          </Link>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-16 pt-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-600">
        ✨ Buat ucapan yang tak terlupakan
      </div>
      <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-6xl">
        Ucapan spesial,<br />
        <span className="text-brand-500">langsung dari hati</span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
        Buat ucapan interaktif untuk ulang tahun, pernikahan, wisuda, dan momen istimewa lainnya.
        Desain bebas, bagikan lewat link — tanpa aplikasi.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="rounded-full bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition-colors"
        >
          Buat Ucapan Sekarang
        </Link>
        <Link
          href="/p/demo"
          className="rounded-full border border-neutral-200 px-8 py-3.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Lihat Contoh
        </Link>
      </div>

      {/* Preview mockup */}
      <div className="mx-auto mt-16 max-w-sm overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-b from-violet-50 to-pink-50 shadow-2xl">
        <div className="flex h-8 items-center gap-1.5 border-b border-neutral-200/60 bg-white/60 px-4 backdrop-blur-sm">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex flex-col items-center gap-4 px-8 py-12">
          <div className="text-5xl">🎂</div>
          <div className="text-center">
            <p className="text-xl font-bold text-neutral-800">Selamat Ulang Tahun!</p>
            <p className="mt-1 text-sm text-neutral-500">Semoga hari-harimu selalu menyenangkan</p>
          </div>
          <div className="mt-2 rounded-full bg-violet-500 px-6 py-2 text-sm font-medium text-white shadow-sm">
            Buka Ucapan
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🎨',
    title: 'Editor Visual Bebas',
    desc: 'Tambahkan teks, gambar, bentuk, ikon, dan tombol ke kanvas. Atur posisi, ukuran, dan gaya sesuai selera.',
  },
  {
    icon: '🎵',
    title: 'Musik Latar',
    desc: 'Lengkapi ucapan dengan musik latar dari perpustakaan kami. Penerima bisa mengaktifkan audio sesuai keinginan.',
  },
  {
    icon: '🔗',
    title: 'Bagikan Lewat Link',
    desc: 'Cukup salin link dan kirimkan. Tidak perlu install aplikasi — ucapan langsung terbuka di browser.',
  },
  {
    icon: '📱',
    title: 'Tampilan Mobile-First',
    desc: 'Setiap scene dirancang untuk layar ponsel. Terlihat indah di semua perangkat tanpa konfigurasi tambahan.',
  },
]

function FeaturesSection() {
  return (
    <section id="fitur" className="border-t border-neutral-100 bg-neutral-50 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-neutral-900">Semua yang kamu butuhkan</h2>
          <p className="mt-3 text-neutral-500">Alat lengkap untuk membuat ucapan yang berkesan</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="mb-2 font-semibold text-neutral-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  { number: '01', title: 'Pilih atau mulai dari nol', desc: 'Gunakan template siap pakai atau mulai dari kanvas kosong sesuai kreativitasmu.' },
  { number: '02', title: 'Desain dan personalisasi', desc: 'Tambahkan teks, foto, musik, dan dekorasi. Atur setiap detail untuk sentuhan personal.' },
  { number: '03', title: 'Publish dan bagikan', desc: 'Satu klik publish. Salin link dan kirimkan ke orang yang kamu sayangi.' },
]

function HowItWorksSection() {
  return (
    <section id="cara-kerja" className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-neutral-900">Cara kerjanya</h2>
          <p className="mt-3 text-neutral-500">Tiga langkah mudah untuk ucapan yang istimewa</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-500">
                {step.number}
              </div>
              <h3 className="mb-2 font-semibold text-neutral-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="border-t border-neutral-100 bg-gradient-to-br from-brand-500 to-violet-600 py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white">Siap membuat ucapan spesial?</h2>
        <p className="mt-4 text-violet-100">
          Gratis selamanya untuk ucapan personal. Tidak perlu kartu kredit.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-brand-600 shadow-sm hover:bg-violet-50 transition-colors"
        >
          Mulai Sekarang — Gratis
        </Link>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-neutral-100 bg-white py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
        <span className="text-sm font-semibold text-neutral-700">
          OpenWish<span className="text-brand-500">Studio</span>
        </span>
        <p className="text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} OpenWish Studio. Dibuat dengan ☕ dan semangat.
        </p>
        <nav className="flex gap-4 text-xs text-neutral-400">
          <a href="#" className="hover:text-neutral-600 transition-colors">Kebijakan Privasi</a>
          <a href="#" className="hover:text-neutral-600 transition-colors">Syarat Penggunaan</a>
        </nav>
      </div>
    </footer>
  )
}
