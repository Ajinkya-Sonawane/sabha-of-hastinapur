import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabha of Hastinapur",
  description: "A Mahabharata-inspired hidden-role party game for 5–10 players. One phone each, no install.",
  applicationName: "Sabha of Hastinapur",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14110d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
          {children}
        </main>
      </body>
    </html>
  );
}
