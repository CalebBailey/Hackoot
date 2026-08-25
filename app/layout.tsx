import type { Metadata, Viewport } from 'next'
import { Inter, Poppins, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const poppins = Poppins({ 
  weight: ['600', '700'],
  subsets: ["latin"],
  variable: '--font-poppins',
});

const jetbrainsMono = JetBrains_Mono({ 
  weight: ['600'],
  subsets: ["latin"],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Hackoot - Interactive Quiz Platform',
  description: 'A Kahoot-style real-time quiz platform for teams. Create, host, and play interactive quizzes.',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D0118' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0118' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased min-h-dvh">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
