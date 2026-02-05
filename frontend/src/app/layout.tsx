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
          <nav className="app-nav mx-auto max-w-5xl px-6 py-4 flex items-center">
            <Link className="nav-link" href="/">
              Insumos
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

            <Link className="nav-link" href="/kardex">
              Kardex
            </Link>

            {/* Ventas = listado */}
            <Link href="/sales" className="nav-link">
              Ventas
            </Link>

            <Link className="nav-link" href="/dashboard">
              Dashboard
            </Link>
          </nav>
        </header>

        <main className="app-main mx-auto max-w-5xl px-6 pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
