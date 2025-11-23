import '../styles/globals.css';

export const metadata = {
  title: 'OffSec Shield - Threat Intelligence',
  description: 'Real-time threat detection and autonomous response'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
