// Reglas de validación compartidas entre las rutas de la API.

const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const HTTPS_URL = /^https:\/\/[^\s"'<>()]+$/;
const LOCAL_PATH = /^\/[A-Za-z0-9/_\-.?=&]+$/;

export const MAX_IMAGE_CHARS = 1_600_000; // ~1.2 MB de foto ya comprimida

export function isUploadedImage(v) {
  return typeof v === "string" && v.length <= MAX_IMAGE_CHARS && DATA_IMAGE.test(v);
}

export function isCatalogImage(v) {
  if (v === "" || v == null) return true;
  if (typeof v !== "string") return false;
  return isUploadedImage(v) || (v.length < 2000 && (HTTPS_URL.test(v) || LOCAL_PATH.test(v)));
}

export const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

export const isISODate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function todayInTexas() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
}

// Flujo del pedido: nuevo (en revisión) → aceptado (Karla lo aceptó; falta el anticipo) →
// confirmado (anticipo pagado) → completado (listo) → entregado. Cancelado en cualquier momento.
export const ORDER_STATUSES = ["nuevo", "aceptado", "confirmado", "completado", "entregado", "cancelado"];
export const PAYMENT_METHODS = ["efectivo", "zelle", "cashapp", "venmo", "tarjeta", "paypal", "transferencia", "otro"];
export const CATEGORIES = ["size", "cake_flavor", "filling", "filling_count", "delivery", "decoration"];

// Primera fecha disponible: 3 días después (viernes → lunes) y desde las 10:00 a. m.
export const MIN_DAYS_AHEAD = 3;
export const MIN_TIME = "10:00";
export const MAX_DECOR_PHOTOS = 4;

export function minDeliveryDate() {
  const [y, m, d] = todayInTexas().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + MIN_DAYS_AHEAD));
  return dt.toISOString().slice(0, 10);
}

export function depositFor(total) {
  const n = Number(total) || 0;
  if (n <= 0) return 0;
  return Math.ceil(n / 2 / 5) * 5;
}

export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function clientIp(req) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export const isShipping = (label) => /env[ií]o|domicilio|delivery/i.test(label || "");
