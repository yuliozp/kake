import "./globals.css";
import { Nunito } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], display: "swap" });

export const metadata = {
  metadataBase: new URL("https://kake-five.vercel.app"),
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
    images: ["https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&q=80"],
  },
};

export const viewport = { themeColor: "#ff5c8a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={nunito.className}>
        <LanguageProvider>
          <Nav />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
