import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SDSinventory",
  description: "Inventario y costeo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <header className="border-b bg-white">
          <nav className="mx-auto max-w-5xl px-6 py-4 flex gap-6">
            <Link className="font-semibold hover:underline" href="/">
              Insumos
            </Link>
            <Link className="font-semibold hover:underline" href="/alerts">
              Alertas
            </Link>
            <Link className="font-semibold hover:underline" href="/products">
            Productos
            </Link>
            <Link className="font-semibold hover:underline" href="/production">
            Producción
            </Link>
            <Link className="font-semibold hover:underline" href="/kardex">
            Kardex
            </Link>
            <Link href="/sales/new" className="font-semibold hover:underline">
            Ventas
            </Link>
          </nav>
        </header>

        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </body>
    </html>
  );
}
