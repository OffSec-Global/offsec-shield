import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OffSec Shield — Security Operations Console',
  description: 'Battle-ready security operations intelligence platform with real-time threat detection, autonomous response, and cryptographic proof ledger.',
  keywords: ['security', 'SOC', 'threat detection', 'autonomous response', 'merkle proofs'],
  authors: [{ name: 'VaultMesh Technologies' }],
  openGraph: {
    title: 'OffSec Shield — Security Operations Console',
    description: 'Real-time threat detection and autonomous defense with cryptographic proofs.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#050507" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
