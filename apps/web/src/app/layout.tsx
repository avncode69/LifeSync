import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/lifesync/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "LifeSync", template: "%s · LifeSync" },
  description: "Your life. In sync.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "LifeSync" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4c1d95" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
