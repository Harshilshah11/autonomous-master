import type { Metadata } from 'next';
import { Syne, DM_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from 'react-hot-toast';

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ARNOBOT GCS — Ground Control Station',
  description: 'UGV Ground Control Station for ARNOBOT SAIBYA on Jetson Orin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${syne.variable} ${dmSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'var(--font-dm-sans)',
              },
              success: { iconTheme: { primary: 'var(--accent-green)', secondary: 'var(--bg-elevated)' } },
              error:   { iconTheme: { primary: 'var(--accent-red)',   secondary: 'var(--bg-elevated)' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
