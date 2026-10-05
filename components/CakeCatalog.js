"use client";
// Tarjetas y filtro del catálogo de pasteles: los usan la página de pedido y la página /catalogo.
import { useI18n } from "@/components/LanguageProvider";
import { translateLabel, trFact } from "@/lib/i18n";

const money = (n) => "$" + Number(n || 0).toFixed(2);

// Grupo del filtro según el tamaño: "6 pulgadas", "8 pulgadas", "10 pulgadas", dos pisos u otros.
export function cakeGroup(c) {
  const s = String(c.size || "").trim();
  if (/^\d+ pulgadas$/.test(s)) return s;
  if (/\by\b/.test(s)) return "pisos";
  return "otros";
}

export function cakeGroups(cakes) {
  const found = new Set(cakes.map(cakeGroup));
  const sizes = [...found].filter((g) => /pulgadas$/.test(g)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return [...sizes, ...(found.has("pisos") ? ["pisos"] : []), ...(found.has("otros") ? ["otros"] : [])];
}

export function CakeFilter({ cakes, value, onChange }) {
  const { t, lang } = useI18n();
  const groups = cakeGroups(cakes);
  if (cakes.length < 9 || groups.length < 2) return null;
  const label = (g) => (g === "pisos" ? t.twoTier : g === "otros" ? t.otherItems : trFact(lang, g));
  return (
    <div className="chips cake-filter" role="group" aria-label={t.filterBy}>
      {["", ...groups].map((g) => (
        <button type="button" key={g || "all"} className={"chip" + (value === g ? " on" : "")} aria-pressed={value === g} onClick={() => onChange(g)}>
          {g ? label(g) : t.allCakes}
        </button>
      ))}
    </div>
  );
}

// Contenido de una tarjeta: foto, nombre, precio, porciones, tamaño y qué se puede elegir.
export function CakeCardBody({ cake: c, footer }) {
  const { t, lang } = useI18n();
  const L = (v) => translateLabel(lang, v);
  // "Porciones: 20-24" (sin repetir la palabra que ya dice la etiqueta).
  const portions = String(trFact(lang, c.portions) || "").replace(/\s*(porciones|servings)$/i, "");
  const facts = [[t.portions, portions], [t.sizeL, trFact(lang, c.size)], [t.frosting, c.frosting]].filter(([, v]) => v);
  return (
    <>
      {c.image && <img src={c.image} alt="" loading="lazy" />}
      <span className="cake-body">
        <span className="cake-top"><strong>{L(c.name)}</strong><span className="price">{money(c.price)}</span></span>
        {facts.length > 0 && (
          <span className="cake-facts">
            {facts.map(([k, v]) => <span key={k}><em>{k}:</em> {v}</span>)}
          </span>
        )}
        {c.description && <span className="cake-desc">{L(c.description)}</span>}
        {(c.options || []).length > 0 && (
          <span className="cake-free">{t.canCustomize}: {c.options.map((g) => L(g.name).toLowerCase()).join(", ")}</span>
        )}
        {footer}
      </span>
    </>
  );
}
