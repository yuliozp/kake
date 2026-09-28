"use client";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { GOOGLE } from "@/lib/google";

function Stars({ value, size }) {
  const full = Math.round(value);
  return (
    <span className="stars" style={size ? { fontSize: size } : undefined} aria-hidden="true">
      {"★".repeat(full)}<span className="stars-off">{"★".repeat(5 - full)}</span>
    </span>
  );
}

function ReviewCard({ r, t }) {
  const [open, setOpen] = useState(false);
  const long = r.text.length > 240;
  const text = open || !long ? r.text : r.text.slice(0, 230).trimEnd() + "…";
  const initial = r.author.trim().charAt(0).toUpperCase();
  return (
    <li className="review">
      <div className="review-head">
        {r.photo
          ? <img src={r.photo} alt="" width="40" height="40" referrerPolicy="no-referrer" loading="lazy" />
          : <span className="avatar" aria-hidden="true">{initial}</span>}
        <div>
          {r.authorUri
            ? <a className="review-author" href={r.authorUri} target="_blank" rel="noreferrer">{r.author}</a>
            : <span className="review-author">{r.author}</span>}
          <div className="note">{r.when}</div>
        </div>
      </div>
      <div className="review-stars">
        <Stars value={r.rating} />
        <span className="sr-only">{r.rating} {t.revOf5}</span>
      </div>
      <p className="review-text">{text}</p>
      <div className="review-foot">
        {long && <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t.revLess : t.revMore}</button>}
        {r.uri && <a className="link" href={r.uri} target="_blank" rel="noreferrer">{t.revOnGoogle}</a>}
      </div>
    </li>
  );
}

export default function Reviews({ data }) {
  const { t } = useI18n();
  const reviews = data?.reviews || [];
  return (
    <section id="resenas" className="card reviews" style={{ marginTop: 16 }} aria-labelledby="resenas-title">
      <div className="reviews-top">
        <div>
          <h2 id="resenas-title">{t.revTitle}</h2>
          {data ? (
            <p className="rating-line">
              <strong className="rating-num">{data.rating.toFixed(1)}</strong>
              <Stars value={data.rating} size={22} />
              <span className="sr-only">{data.rating.toFixed(1)} {t.revOf5}.</span>
              <span className="note">{data.total} {t.revCount}</span>
            </p>
          ) : (
            <p className="rating-line"><Stars value={5} size={22} /></p>
          )}
          <p>{t.revBody}</p>
        </div>
        <div className="reviews-actions">
          <a className="btn" href={GOOGLE.writeReview} target="_blank" rel="noreferrer">{t.revWrite}</a>
          <a className="btn ghost" href={data?.mapsUri || GOOGLE.mapsShort} target="_blank" rel="noreferrer">{t.revReadAll}</a>
        </div>
      </div>

      {reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((r, i) => <ReviewCard key={r.uri || i} r={r} t={t} />)}
        </ul>
      )}

      <p className="google-attrib">
        <GoogleMark /> {t.revSource}
      </p>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.4 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-3.9-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
