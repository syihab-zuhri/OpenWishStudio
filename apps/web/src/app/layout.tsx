import type { Metadata } from 'next'
import { Bebas_Neue, Poppins } from 'next/font/google'
import '@/styles/globals.css'

// Display: substitute Bebas Neue untuk display art-deco deck (lihat design.md)
const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

// UI/body font — app chrome. Font konten scene user berasal dari template registry.
const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'OpenWish Studio',
  description: 'Buat ucapan interaktif dan bagikan melalui link',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${bebas.variable} ${poppins.variable}`}>
      <body className="bg-background text-text-primary font-sans antialiased">{children}</body>
    </html>
  )
}
