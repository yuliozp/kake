import "./globals.css";
import { Nunito } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getSiteMenu } from "@/lib/db";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], display: "swap" });

export const metadata = {
  metadataBase: new URL("https://karlasbake.com"),
  title: {
    default: "Karla's Bake — Pasteles personalizados en Port Arthur, TX",
    template: "%s · Karla's Bake",
  },
  description:
    "Pastelería artesanal en Port Arthur, Texas. Pide tu pastel personalizado en minutos: tamaño, sabor, relleno y diseño. Custom cakes made by hand.",
  openGraph: {
    title: "Karla's Bake — Pasteles personalizados",
    description: "Pide tu pastel personalizado en minutos. Custom cakes in Port Arthur, TX.",
    type: "website",
    locale: "es_US",
    images: [{ url: "/og-logo.jpg", width: 1200, height: 630, alt: "Logo de Karla's Bake" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Karla's Bake — Pasteles personalizados",
    description: "Pide tu pastel personalizado en minutos. Custom cakes in Port Arthur, TX.",
    images: ["/og-logo.jpg"],
  },
};

export const viewport = { themeColor: "#ff5c8a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }) {
  // Enlaces del menú según las secciones que Karla tenga visibles en "Personalizar web".
  const menu = await getSiteMenu().catch((e) => { console.error("[layout] menú", e); return null; });
  return (
    <html lang="es">
      <body className={nunito.className}>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <LanguageProvider>
          <Nav menu={menu} />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
