"use client";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { CakeCardBody, CakeFilter, cakeGroup } from "@/components/CakeCatalog";
import { translateLabel } from "@/lib/i18n";

// Catálogo público: el cliente puede ver pasteles y precios antes de empezar su pedido.
export default function CatalogPage({ cakes }) {
  const { t, lang } = useI18n();
  const [group, setGroup] = useState("");
  const shown = group ? cakes.filter((c) => cakeGroup(c) === group) : cakes;
  return (
    <main id="contenido" className="wrap">
      <section className="card">
        <h1 className="h2">{t.catalogTitle}</h1>
        <p>{t.catalogLead}</p>
        <CakeFilter cakes={cakes} value={group} onChange={setGroup} />
        <div className="cake-grid catalog">
          <a className="cake-card custom" href="/pedido?medida=1">
            <span className="cake-body">
              <span className="cake-top"><strong>{t.customTitle}</strong></span>
              <span className="cake-desc">{t.customDesc}</span>
              <span className="cake-free">{t.customPrice}</span>
            </span>
          </a>
          {shown.map((c) => (
            <div key={c.id} className="cake-card product">
              <CakeCardBody cake={c} footer={
                <a className="btn small cake-order" href={`/pedido?pastel=${c.id}`} aria-label={`${t.orderThis}: ${translateLabel(lang, c.name)}`}>{t.orderThis}</a>
              } />
            </div>
          ))}
        </div>
        {cakes.length === 0 && <p className="note">{t.catalogEmpty}</p>}
      </section>
    </main>
  );
}
