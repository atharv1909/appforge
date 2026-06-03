import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AppForge — AI App Compiler',
  description: 'Natural Language → App Architecture. A multi-stage AI compiler that generates validated, executable app schemas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}