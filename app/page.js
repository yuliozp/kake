"use client";
import { IMAGES } from "@/lib/defaults";
import Logo from "@/components/Logo";
import { useI18n } from "@/components/LanguageProvider";

const MAP = "https://www.google.com/maps/search/?api=1&query=3920+Highway+365+Apt+247+Building+17+Port+Arthur+Texas+77642";
const WA = "https://wa.me/14093325768";
const SMS = "sms:+14093325768";
const CALL = "tel:+14093325768";

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="wrap promo">
      <section id="inicio" className="hero">
        <div>
          <Logo size={120} />
          <p className="note">{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lead">{t.heroLead}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <a className="btn" href="/pedido">{t.customize}</a>
            <a className="btn ghost" href="#contacto">{t.contactUs}</a>
          </div>
        </div>
        <img src={IMAGES.hero} alt={t.cakeAlt} />
      </section>

      <section id="novedades" className="card" style={{ marginTop: 24 }}>
        <h2>{t.newsTitle}</h2>
        <p>{t.newsBody}</p>
        <p className="note">{t.newsNote}</p>
      </section>

      <section id="talento" className="card" style={{ marginTop: 16 }}>
        <h2>{t.talentTitle}</h2>
        <p>{t.talentBody}</p>
        <p className="note">{t.talentNote}</p>
      </section>

      <section id="contacto" className="card" style={{ marginTop: 16 }}>
        <h2>{t.contactTitle}</h2>
        <p>
          <a href={MAP} target="_blank" rel="noreferrer">3920 Highway 365 Apt 247 Building 17, Port Arthur, Texas, 77642</a>
        </p>
        <p>Cell: <a href={CALL}>+1 (409) 332-5768</a></p>
        <div className="row">
          <a className="btn" href={CALL}>{t.call}</a>
          <a className="btn ghost" href={SMS}>{t.sms}</a>
          <a className="btn ghost" href={WA} target="_blank" rel="noreferrer">{t.whatsapp}</a>
        </div>
        <p>Email: <a href="mailto:karlagabyzorrilla@gmail.com">karlagabyzorrilla@gmail.com</a></p>
        <p>
          <a href="https://www.facebook.com/karla.sbake" target="_blank" rel="noreferrer">Facebook</a>
          {" · "}
          <a href="https://www.instagram.com/karlasbake/" target="_blank" rel="noreferrer">Instagram</a>
          {" · "}
          <a href="https://www.tiktok.com/@karlasbake" target="_blank" rel="noreferrer">TikTok</a>
        </p>
      </section>
    </main>
  );
}
