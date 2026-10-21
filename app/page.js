import HomePage from "@/components/HomePage";
import { getGoogleReviews } from "@/lib/google";
import { getSitePhotos } from "@/lib/db";

// Portada fresca: lo editado en admin se ve al recargar. Las reseñas se piden en cada visita.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [es, en, photos] = await Promise.all([
    getGoogleReviews("es"),
    getGoogleReviews("en"),
    getSitePhotos().catch((e) => { console.error("[home] fotos", e); return null; }),
  ]);
  const google = es || en ? { es: es || en, en: en || es } : null;
  return <HomePage google={google} photos={photos} />;
}
