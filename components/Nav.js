"use client";
import { useI18n } from "./LanguageProvider";
import Logo from "./Logo";

export default function Nav() {
  const { lang, t, setLang } = useI18n();
  return (
    <nav className="nav wrap">
      <Logo />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <a className="note" href="https://www.instagram.com/karlasbake/" target="_blank" rel="noreferrer">@karlasbake</a>
        <div className="lang-switch" role="group" aria-label="Language">
          <button className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>ES</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
        <a href="/pedido" className="btn">{t.orderNow}</a>
        <a href="/admin" className="btn ghost">{t.admin}</a>
      </div>
    </nav>
  );
}
