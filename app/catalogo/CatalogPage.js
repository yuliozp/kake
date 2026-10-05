"use client";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { CakeCardBody, CakeFilter, cakeGroup } from "@/components/CakeCatalog";

// Catálogo público: el cliente puede ver pasteles y precios antes de empezar su pedido.
export default function CatalogPage({ cakes }) {
  const { t } = useI18n();
  const [group, setGroup] = useState("");
  const shown = group ? cakes.filter((c) => cakeGroup(c) === group) : cakes;
  return (
    <main id="contenido" className="wrap">
      <section className="card">
        <h1 className="h2">{t.catalogTitle}</h1>
        <p>{t.catalogLead}</p>
        {cakes.length === 0 ? (
          <p className="note">{t.catalogEmpty}</p>
        ) : (
          <>
            <CakeFilter cakes={cakes} value={group} onChange={setGroup} />
            <ul className="cake-grid catalog">
              {shown.map((c) => (
                <li key={c.id}>
                  <a className="cake-card" href={`/pedido?pastel=${c.id}`}>
                    <CakeCardBody cake={c} footer={<span className="cake-cta">{t.orderThis} →</span>} />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
