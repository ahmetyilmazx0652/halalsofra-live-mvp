import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HalalSofra | Avrupa Helal Restoran Rehberi",
    template: "%s | HalalSofra"
  },
  description: "Avrupa'da helal restoran, kafe, fırın, market ve kasapları şehir, sertifika, menü, fiyat ve konum bilgileriyle keşfet.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "HalalSofra | Avrupa Helal Restoran Rehberi",
    description: "Ülke seç, şehir seç, güvenilir helal mekan bul.",
    url: siteUrl,
    siteName: "HalalSofra",
    locale: "tr_TR",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="shell">
          <header className="topbar">
            <a className="brand" href="/">
              <span className="mark">H</span>
              <span>HalalSofra</span>
            </a>
            <nav className="nav">
              <a href="/">Restoranlar</a>
              <a className="button primary" href="/owner">Restoran Ekle</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
