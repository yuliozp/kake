import HomePage from "@/components/HomePage";
import { getGoogleReviews } from "@/lib/google";

// La página de inicio se regenera como máximo una vez al día,
// y con ella la calificación y las reseñas de Google.
export const revalidate = 86400;

export default async function Home() {
  const [es, en] = await Promise.all([getGoogleReviews("es"), getGoogleReviews("en")]);
  const google = es || en ? { es: es || en, en: en || es } : null;
  return <HomePage google={google} />;
}
