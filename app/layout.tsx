import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bubble bloom',
  description: 'Created with love by bubble bloom',
  generator: 'bubble bloom',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
