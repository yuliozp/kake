import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import Nav from "@/components/Nav";

export const metadata = {
  title: "kake — custom cakes / pasteles a tu medida",
  description: "Order your custom kake in minutes / Pide tu kake personalizado",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <LanguageProvider>
          <Nav />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
