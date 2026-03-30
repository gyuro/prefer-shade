import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prefer Shade — Walk in the Shade',
  description: 'Shadow-driven pedestrian routing. Find the shadiest path to your destination.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ height: '100vh', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
