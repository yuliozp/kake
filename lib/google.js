// Ficha de Karla's Bake en Google Maps y reseñas de clientes.
//
// Las reseñas se piden a Google Places con caché de 24 horas (revalidate),
// así que el sitio hace como máximo unas pocas consultas al día sin importar
// cuántas visitas tenga. Si falta GOOGLE_PLACES_API_KEY o Google falla,
// la sección se muestra igual, solo que sin el listado de reseñas.

export const PLACE_ID = "ChIJbQllM2SxPoYRw2PJ7Cj3bl8";
const ADDRESS = "3920 FM 365 Building 17 Apt 247, Port Arthur, TX 77642";

export const GOOGLE = {
  placeId: PLACE_ID,
  address: ADDRESS,
  mapsShort: "https://maps.app.goo.gl/iyoHNmjmG9kvisSs5",
  mapsPlace: `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
  writeReview: `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}&destination_place_id=${PLACE_ID}`,
  embed: `https://www.google.com/maps?q=${encodeURIComponent("Karla's Bake, " + ADDRESS)}&output=embed`,
};

export const REVALIDATE_SECONDS = 86400; // 24 horas

const https = (u) => (!u ? "" : u.startsWith("//") ? "https:" + u : u.startsWith("https://") ? u : "");

export async function getGoogleReviews(lang = "es") {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=${lang}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.warn("[google] Places respondió", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const d = await res.json();
    if (typeof d.rating !== "number") return null;
    const reviews = (d.reviews || [])
      .map((r) => ({
        author: r.authorAttribution?.displayName || "Cliente de Google",
        authorUri: https(r.authorAttribution?.uri),
        photo: https(r.authorAttribution?.photoUri),
        rating: Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0))),
        text: (r.text?.text || r.originalText?.text || "").trim(),
        when: r.relativePublishTimeDescription || "",
        publishTime: r.publishTime || "",
        uri: https(r.googleMapsUri),
      }))
      .filter((r) => r.text);
    return {
      rating: d.rating,
      total: Number(d.userRatingCount) || 0,
      mapsUri: https(d.googleMapsUri) || GOOGLE.mapsPlace,
      reviews,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn("[google] no se pudieron leer las reseñas:", e?.message || e);
    return null;
  }
}
