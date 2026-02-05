import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SDSinventory",
  description: "Inventario y costeo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <header className="app-header">
          <nav className="app-nav mx-auto max-w-5xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link className="text-xl font-bold" href="/">
                SDSinventory
              </Link>
              <span className="text-xs text-zinc-500">Costeo & Inventario</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link className="nav-link" href="/">
                Insumos
              </Link>

              <Link className="nav-link" href="/purchases">
                Compras
              </Link>

              <Link className="nav-link" href="/alerts">
                Alertas
              </Link>

              <Link className="nav-link" href="/products">
                Productos
              </Link>

              <Link className="nav-link" href="/production">
                Producción
              </Link>

              <Link className="nav-link" href="/fixed-costs">
                Costos fijos
              </Link>

              <Link className="nav-link" href="/kardex">
                Kardex
              </Link>

              <Link href="/sales" className="nav-link">
                Ventas
              </Link>

              <Link className="nav-link" href="/quotes">
                Cotizaciones
              </Link>

              <Link className="nav-link" href="/dashboard">
                Dashboard
              </Link>
            </div>
          </nav>
        </header>

        <main className="app-main mx-auto max-w-5xl px-6 pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
