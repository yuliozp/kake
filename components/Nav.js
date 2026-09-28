"use client";
import { useI18n } from "./LanguageProvider";
import Logo from "./Logo";

export default function Nav() {
  const { lang, t, setLang } = useI18n();
  return (
    <nav className="nav wrap">
      <Logo />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <a className="note" href="/#inicio">{t.navHome}</a>
        <a className="note" href="/#novedades">{t.navNews}</a>
        <a className="note" href="/#talento">{t.navTalent}</a>
        <a className="note" href="/#contacto">{t.navContact}</a>
        <div className="lang-switch" role="group">
          <button className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>ES</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
        <a href="/pedido" className="btn">{t.orderNow}</a>
        <a href="/admin" className="btn ghost" target="_blank" rel="noreferrer">{t.admin}</a>
      </div>
    </nav>
  );
}
