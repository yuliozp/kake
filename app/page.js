import HomePage from "@/components/HomePage";
import { getGoogleReviews } from "@/lib/google";
import { getSitePhotos } from "@/lib/db";

// La página de inicio se regenera como máximo una vez al día (reseñas de Google)
// y cada vez que se cambian las fotos desde "Personalizar web" en el panel.
export const revalidate = 86400;

export default async function Home() {
  const [es, en, photos] = await Promise.all([
    getGoogleReviews("es"),
    getGoogleReviews("en"),
    getSitePhotos().catch((e) => { console.error("[home] fotos", e); return null; }),
  ]);
  const google = es || en ? { es: es || en, en: en || es } : null;
  return <HomePage google={google} photos={photos} />;
}
