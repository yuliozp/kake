"use client";
import { IMAGES } from "@/lib/defaults";
import { useI18n } from "@/components/LanguageProvider";

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <p className="note">{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lead">{t.heroLead}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <a className="btn" href="/pedido">{t.customize}</a>
            <a className="btn ghost" href="https://www.instagram.com/p/DdxZZgTDp9a/" target="_blank">{t.instagram}</a>
          </div>
        </div>
        <img src={IMAGES.hero} alt={t.cakeAlt} />
      </section>
      <section className="grid">
        {t.cards.map((c) => (
          <div className="card" key={c.t}><strong>{c.t}</strong><p className="note">{c.d}</p></div>
        ))}
      </section>
    </main>
  );
}
