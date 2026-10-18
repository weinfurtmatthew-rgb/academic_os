import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/bricolage-grotesque';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: { default: 'Academic OS', template: '%s · Academic OS' },
  description: 'Your offline-first academic command center — courses, assignments, exams, notes, grades and study planning in one place.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Academic OS',
  },
};

export const viewport: Viewport = {
  themeColor: '#F6F7FB',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/* Applies dark class before paint to avoid theme flash. */
const themeScript = `
(function(){try{
  var s = JSON.parse(localStorage.getItem('academic-os-settings')||'{}');
  var t = s.theme || 'system';
  var d = t==='dark' || (t==='system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(d) document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
