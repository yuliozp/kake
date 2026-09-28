"use client";
import { usePathname } from "next/navigation";
import { useI18n } from "./LanguageProvider";
import Logo from "./Logo";

export default function Nav() {
  const { lang, t, setLang } = useI18n();
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  return (
    <header className="nav wrap">
      <Logo />
      <nav className="nav-links" aria-label="Principal">
        <a href="/#novedades">{t.navNews}</a>
        <a href="/#talento">{t.navTalent}</a>
        <a href="/#contacto">{t.navContact}</a>
      </nav>
      <div className="nav-actions">
        <div className="lang-switch" role="group" aria-label="Idioma / Language">
          <button className={lang === "es" ? "on" : ""} aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button>
          <button className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
        </div>
        {path !== "/pedido" && <a href="/pedido" className="btn">{t.orderNow}</a>}
      </div>
    </header>
  );
}
