import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AuroraSense — Follow the evidence', description: 'See the storm. Find the aurora. Measure Earth’s response. A scientific observation prototype.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
