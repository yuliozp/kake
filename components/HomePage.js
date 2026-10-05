"use client";
import { IMAGES } from "@/lib/defaults";
import Logo from "@/components/Logo";
import { useI18n } from "@/components/LanguageProvider";
import { NEWS, TALENT } from "@/lib/gallery";
import { GOOGLE } from "@/lib/google";
import { PhoneIcon, SmsIcon, WhatsAppIcon, FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/Icons";
import Reviews from "@/components/Reviews";

function Gallery({ items, lang, alt }) {
  if (!items.length) return null;
  return (
    <div className={"gallery n" + items.length}>
      {items.map((it) => (
        <figure key={it.id || it.src} className="shot">
          <img src={it.src} alt={it[lang] || it.es || alt} loading="lazy" />
          {(it[lang] || it.es) && <figcaption>{it[lang] || it.es}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

const WA = "https://wa.me/14093325768";
const SMS = "sms:+14093325768";
const CALL = "tel:+14093325768";

export default function HomePage({ google, photos }) {
  const { t, lang } = useI18n();
  // Fotos elegidas en el panel ("Personalizar web"); si no cargan, las de siempre.
  const news = photos?.novedades ?? NEWS;
  const talent = photos?.talento ?? TALENT;
  const hero = photos?.portada?.[0]?.src || IMAGES.hero;
  return (
    <main id="contenido" className="wrap promo">
      <section id="inicio" className="hero">
        <div>
          <Logo size={120} />
          <p className="note">{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lead">{t.heroLead}</p>
          {google?.es && (
            <a className="hero-rating" href="#resenas">
              <span className="stars" aria-hidden="true">★★★★★</span>
              <span>{google.es.rating.toFixed(1)} · {google.es.total} {t.revCount}</span>
            </a>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <a className="btn" href="/catalogo">{t.seeCatalog}</a>
            <a className="btn ghost" href="#contacto">{t.contactUs}</a>
          </div>
        </div>
        <img src={hero} alt={t.cakeAlt} />
      </section>

      <section id="novedades" className="card" style={{ marginTop: 24 }}>
        <h2>{t.newsTitle}</h2>
        <p>{t.newsBody}</p>
        <Gallery items={news} lang={lang} alt={t.cakeAlt} />
        <p className="note">{t.newsNote}</p>
      </section>

      <section id="talento" className="card" style={{ marginTop: 16 }}>
        <h2>{t.talentTitle}</h2>
        <p>{t.talentBody}</p>
        <Gallery items={talent} lang={lang} alt={t.cakeAlt} />
        <p className="note">{t.talentNote}</p>
      </section>

      <Reviews data={google?.[lang] || google?.es || null} />

      <section id="contacto" className="card" style={{ marginTop: 16 }}>
        <h2>{t.contactTitle}</h2>
        <div className="contact-grid">
          <div>
            <p>
              <a href={GOOGLE.mapsShort} target="_blank" rel="noreferrer">3920 Highway 365 Apt 247 Building 17, Port Arthur, Texas, 77642</a>
            </p>
            <p>Cell: <a href={CALL}>+1 (409) 332-5768</a></p>
            <div className="contact-row">
              <a className="btn contact call" href={CALL}><PhoneIcon />{t.call}</a>
              <a className="btn contact sms" href={SMS}><SmsIcon />{t.sms}</a>
              <a className="btn contact wa" href={WA} target="_blank" rel="noreferrer"><WhatsAppIcon />{t.whatsapp}</a>
            </div>
            <p>Email: <a href="mailto:karlasbake25@gmail.com">karlasbake25@gmail.com</a></p>
            <div className="social-row">
              <a className="social fb" href="https://www.facebook.com/karla.sbake" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook"><FacebookIcon /></a>
              <a className="social ig" href="https://www.instagram.com/karlasbake/" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram"><InstagramIcon /></a>
              <a className="social tt" href="https://www.tiktok.com/@karlasbake" target="_blank" rel="noreferrer" aria-label="TikTok" title="TikTok"><TikTokIcon /></a>
            </div>
          </div>
          <div className="map-card">
            <iframe
              src={GOOGLE.embed}
              title={t.mapTitle}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="map-links">
              <a href={GOOGLE.directions} target="_blank" rel="noreferrer">{t.directions}</a>
              <a href={GOOGLE.mapsShort} target="_blank" rel="noreferrer">{t.openMaps}</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
