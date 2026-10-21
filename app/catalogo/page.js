import CatalogPage from "./CatalogPage";
import { getCatalog } from "@/lib/db";

export const metadata = {
  title: "Catálogo de pasteles",
  description: "Catálogo de Karla's Bake en Port Arthur, Texas: pasteles, cupcakes y más, con precios, porciones y tamaños. Pide el tuyo en línea.",
};

// Siempre fresco: lo que se edita en admin se ve al recargar.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const cakes = await getCatalog().then((c) => c.cakes || []).catch((e) => { console.error("[catalogo]", e); return []; });
  return <CatalogPage cakes={cakes.map((c) => ({ ...c, price: Number(c.price) }))} />;
}
