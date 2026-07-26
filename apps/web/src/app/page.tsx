import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
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
    <header className="border-border/60 bg-background/90 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-text-primary text-base uppercase tracking-[0.06em] sm:text-lg"
        >
          OpenWish Studio
        </Link>
        <nav className="hidden items-center gap-6 sm:flex">
          <a
            href="#fitur"
            className="text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            Fitur
          </a>
          <a
            href="#cara-kerja"
            className="text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            Cara Kerja
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="text-text-secondary hover:bg-surface-hover hover:text-text-primary rounded-sm px-2.5 py-2 text-sm transition-colors sm:px-4"
          >
            Masuk
          </Link>
          <Link
            href="/dashboard"
            className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
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
    <section className="bg-spotlight relative">
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-16 text-center sm:pt-24">
        <div className="border-border bg-surface text-text-secondary inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.14em] sm:text-xs">
          Buat ucapan yang tak terlupakan
        </div>
        <h1 className="font-display text-text-primary mt-8 text-5xl uppercase leading-none tracking-[0.02em] sm:text-6xl md:text-7xl">
          Ucapan spesial,
          <br />
          <span className="text-secondary">langsung dari hati</span>
        </h1>
        <p className="text-text-secondary mx-auto mt-6 max-w-xl text-base sm:text-lg">
          Buat ucapan interaktif untuk ulang tahun, pernikahan, wisuda, dan momen istimewa lainnya.
          Desain bebas, bagikan lewat link — tanpa aplikasi.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.06em] transition-colors"
          >
            Buat Ucapan Sekarang
          </Link>
          <Link
            href="/p/demo"
            className="border-border-strong text-text-primary hover:bg-surface-hover rounded-sm border px-8 py-3.5 text-sm font-medium uppercase tracking-[0.06em] transition-colors"
          >
            Lihat Contoh
          </Link>
        </div>

        {/* Preview mockup — konten ucapan (karya user) sengaja tetap cerah di atas chrome gelap */}
        <div className="bg-surface mx-auto mt-16 max-w-sm overflow-hidden rounded-xl shadow-xl">
          <div className="bg-surface-2 flex h-8 items-center gap-1.5 px-4">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex flex-col items-center gap-4 bg-gradient-to-b from-violet-50 to-pink-50 px-8 py-12">
            <div className="text-5xl">🎂</div>
            <div className="text-center">
              <p className="text-xl font-bold text-neutral-800">Selamat Ulang Tahun!</p>
              <p className="mt-1 text-sm text-neutral-500">
                Semoga hari-harimu selalu menyenangkan
              </p>
            </div>
            <div className="mt-2 rounded-full bg-violet-500 px-6 py-2 text-sm font-medium text-white shadow-sm">
              Buka Ucapan
            </div>
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
    <section id="fitur" className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <p className="text-text-secondary text-xs font-medium uppercase tracking-[0.14em]">
            Fitur
          </p>
          <h2 className="font-display text-text-primary mt-3 text-3xl uppercase tracking-[0.03em] sm:text-4xl">
            Semua yang kamu butuhkan
          </h2>
          <p className="text-text-secondary mt-3">
            Alat lengkap untuk membuat ucapan yang berkesan
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface rounded-md p-6 shadow-sm">
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="text-text-primary mb-2 font-semibold">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    title: 'Pilih atau mulai dari nol',
    desc: 'Gunakan template siap pakai atau mulai dari kanvas kosong sesuai kreativitasmu.',
  },
  {
    number: '02',
    title: 'Desain dan personalisasi',
    desc: 'Tambahkan teks, foto, musik, dan dekorasi. Atur setiap detail untuk sentuhan personal.',
  },
  {
    number: '03',
    title: 'Publish dan bagikan',
    desc: 'Satu klik publish. Salin link dan kirimkan ke orang yang kamu sayangi.',
  },
]

function HowItWorksSection() {
  return (
    <section id="cara-kerja" className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <p className="text-text-secondary text-xs font-medium uppercase tracking-[0.14em]">
            Alur
          </p>
          <h2 className="font-display text-text-primary mt-3 text-3xl uppercase tracking-[0.03em] sm:text-4xl">
            Cara kerjanya
          </h2>
          <p className="text-text-secondary mt-3">Tiga langkah mudah untuk ucapan yang istimewa</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center">
              <div className="font-display text-primary mb-3 text-5xl tabular-nums">
                {step.number}
              </div>
              <h3 className="text-text-primary mb-2 font-semibold">{step.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
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
    <section className="bg-surface bg-spotlight relative overflow-hidden py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="font-display text-text-primary text-3xl uppercase tracking-[0.03em] sm:text-4xl">
          Siap membuat ucapan spesial?
        </h2>
        <p className="text-text-secondary mt-4">
          Gratis selamanya untuk ucapan personal. Tidak perlu kartu kredit.
        </p>
        <Link
          href="/dashboard"
          className="bg-primary text-text-on-primary hover:bg-primary-hover mt-8 inline-block rounded-sm px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.06em] transition-colors"
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
    <footer className="border-border border-t py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
        <span className="font-display text-text-primary text-sm uppercase tracking-[0.06em]">
          OpenWish Studio
        </span>
        <p className="text-text-muted text-xs">
          &copy; {new Date().getFullYear()} OpenWish Studio. Dibuat dengan ☕ dan semangat.
        </p>
        <nav className="text-text-muted flex gap-4 text-xs">
          <a href="#" className="hover:text-text-secondary transition-colors">
            Kebijakan Privasi
          </a>
          <a href="#" className="hover:text-text-secondary transition-colors">
            Syarat Penggunaan
          </a>
        </nav>
      </div>
    </footer>
  )
}
