import "./globals.css";

export const metadata = {
  title: "kake — Pasteles a tu medida",
  description: "Pide tu kake personalizado en minutos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <nav className="nav wrap">
          <a className="logo" href="/">kake</a>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="/pedido" className="btn">Pedir ahora</a>
            <a href="/admin" className="btn ghost">Admin</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
