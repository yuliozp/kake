"use client";
import { usePathname } from "next/navigation";
import { useI18n } from "./LanguageProvider";

export default function Footer() {
  const { t } = useI18n();
  const path = usePathname();
  if (path?.startsWith("/admin") || path === "/pedido") return null;
  return (
    <footer className="footer wrap">
      <p><strong>Karla&apos;s Bake</strong> · {t.footer}</p>
      <p className="note">© {new Date().getFullYear()} Karla&apos;s Bake. {t.rights}</p>
    </footer>
  );
}
