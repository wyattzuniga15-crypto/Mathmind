import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MathMind — AI Assistant',
  description:
    'A general-purpose AI assistant with a dedicated Code mode. Math and calculations are checked by an exact symbolic engine rather than produced from memory.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    // Installed from Safari's Share sheet rather than a store, so this is
    // what actually makes "Add to Home Screen" open as an app instead of a
    // browser tab with address bar chrome.
    capable: true,
    statusBarStyle: 'default',
    title: 'MathMind',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1115' },
  ],
};

/** Applies the stored theme before paint so there is no light-mode flash. */
const themeScript = `
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('tutor.settings.v1') || '{}');
    var t = s.theme || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
