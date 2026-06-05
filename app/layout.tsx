import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "HalalSofra",
  description: "Avrupa'da helal restoran keşif ve işletme platformu"
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
              <a href="/owner">İşletmeler</a>
              <a className="button primary" href="/owner">Restoranımı Ekle</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
