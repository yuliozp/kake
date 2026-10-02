import { neon } from "@neondatabase/serverless";
import { defaultCatalog, IMAGES } from "./defaults";
import { NEWS, TALENT } from "./gallery";
import { todayInTexas } from "./validate";

// Respaldo en memoria para desarrollo local sin DATABASE_URL.
// Va en globalThis para que las páginas y las rutas de la API compartan los mismos datos.
const memory = globalThis.__kakeMemory || (globalThis.__kakeMemory = {
  orders: [],
  options: JSON.parse(JSON.stringify(defaultCatalog.options)),
  designs: JSON.parse(JSON.stringify(defaultCatalog.designs)),
  limits: new Map(),
  photos: [],
  cakes: [],
  sitePhotos: null,
  settings: {},
});

// Fotos de la portada por defecto (las que venían fijas en el sitio).
const DEFAULT_SITE_PHOTOS = [
  { section: "portada", image_url: IMAGES.hero, caption_es: "", caption_en: "" },
  ...NEWS.map((n) => ({ section: "novedades", image_url: n.src, caption_es: n.es, caption_en: n.en })),
  ...TALENT.map((n) => ({ section: "talento", image_url: n.src, caption_es: n.es, caption_en: n.en })),
];
if (!memory.sitePhotos) memory.sitePhotos = DEFAULT_SITE_PHOTOS.map((ph, i) => ({ ...ph, id: i + 1, sort: i + 1, active: true }));
export const SITE_SECTIONS = ["portada", "novedades", "talento"];

let client = null;
function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!client) client = neon(url);
  return client;
}

// El esquema se verifica una sola vez por instancia, no en cada petición.
let schemaReady = null;
function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = createSchema(sql).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

async function createSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT,
    sms_opt_in BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT,
    delivery_type TEXT,
    delivery_address TEXT,
    delivery_date DATE,
    delivery_time TEXT,
    size_label TEXT,
    cake_flavor TEXT,
    filling_flavor TEXT,
    filling_count INTEGER,
    design_label TEXT,
    design_image TEXT,
    selections JSONB,
    total NUMERIC(10,2),
    ordered_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS design_notes TEXT,
    ADD COLUMN IF NOT EXISTS client_ref TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'nuevo',
    ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS final_total NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paid_at DATE,
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS payment_note TEXT,
    ADD COLUMN IF NOT EXISTS payment_proof TEXT,
    ADD COLUMN IF NOT EXISTS payment_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lang TEXT,
    ADD COLUMN IF NOT EXISTS decoration_label TEXT,
    ADD COLUMN IF NOT EXISTS decoration_notes TEXT,
    ADD COLUMN IF NOT EXISTS price_pending BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pending_items TEXT,
    ADD COLUMN IF NOT EXISTS price_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
    ADD COLUMN IF NOT EXISTS cake_id INTEGER,
    ADD COLUMN IF NOT EXISTS cake_name TEXT,
    ADD COLUMN IF NOT EXISTS cake_details TEXT,
    ADD COLUMN IF NOT EXISTS cake_options TEXT`;
  // Estados nuevos: "entregado" pasa a llamarse "completado".
  await sql`UPDATE orders SET status = 'completado' WHERE status = 'entregado'`;
  await sql`CREATE TABLE IF NOT EXISTS order_photos (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'decoration',
    image TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS order_photos_order_idx ON order_photos (order_id)`;
  // Pagos en línea (Stripe). session_id único: un mismo pago nunca se registra dos veces.
  await sql`CREATE TABLE IF NOT EXISTS online_payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE NOT NULL,
    payment_intent TEXT,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_client_ref_key ON orders (client_ref) WHERE client_ref IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS orders_delivery_idx ON orders (delivery_date)`;
  await sql`CREATE TABLE IF NOT EXISTS catalog_options (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE
  )`;
  await sql`ALTER TABLE catalog_options ADD COLUMN IF NOT EXISTS price_on_request BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS designs (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    image_url TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
  )`;
  // Pasteles del catálogo: lo primero que ve el cliente al pedir.
  await sql`CREATE TABLE IF NOT EXISTS cakes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    portions TEXT,
    size TEXT,
    frosting TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    image_url TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Fotos de la portada, elegidas desde "Personalizar web".
  await sql`CREATE TABLE IF NOT EXISTS site_photos (
    id SERIAL PRIMARY KEY,
    section TEXT NOT NULL,
    image_url TEXT NOT NULL,
    caption_es TEXT,
    caption_en TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
  )`;
  const [{ c }] = await sql`SELECT COUNT(*)::int AS c FROM catalog_options`;
  if (c === 0) {
    for (const o of defaultCatalog.options) {
      await sql`INSERT INTO catalog_options (category,label,description,price,image_url,active)
        VALUES (${o.category},${o.label},${o.description || ""},${o.price},${o.image || ""},true)`;
    }
  }
  // Categoría de decoración (sencilla incluida / premium con precio a confirmar).
  const [{ dc }] = await sql`SELECT COUNT(*)::int AS dc FROM catalog_options WHERE category = 'decoration'`;
  if (dc === 0) {
    for (const o of defaultCatalog.options.filter((x) => x.category === "decoration")) {
      await sql`INSERT INTO catalog_options (category,label,description,price,image_url,active,price_on_request)
        VALUES (${o.category},${o.label},${o.description || ""},${o.price},${o.image || ""},true,${!!o.price_on_request})`;
    }
  }
  // Primera vez: la portada arranca con las fotos que ya tenía el sitio.
  const [{ seeded }] = await sql`SELECT EXISTS (SELECT 1 FROM site_settings WHERE key = 'site_photos_seeded') AS seeded`;
  if (!seeded) {
    const [{ sp }] = await sql`SELECT COUNT(*)::int AS sp FROM site_photos`;
    if (sp === 0) {
      let i = 0;
      for (const ph of DEFAULT_SITE_PHOTOS) {
        i += 1;
        await sql`INSERT INTO site_photos (section,image_url,caption_es,caption_en,sort,active)
          VALUES (${ph.section},${ph.image_url},${ph.caption_es},${ph.caption_en},${i},true)`;
      }
    }
    await sql`INSERT INTO site_settings (key, value) VALUES ('site_photos_seeded', '1') ON CONFLICT (key) DO NOTHING`;
  }
  const [{ d }] = await sql`SELECT COUNT(*)::int AS d FROM designs`;
  if (d === 0) {
    for (const o of defaultCatalog.designs) {
      await sql`INSERT INTO designs (label,image_url,price,active) VALUES (${o.label},${o.image},${o.price},true)`;
    }
  }
}

async function db() {
  const sql = sqlClient();
  if (sql) await ensureSchema(sql);
  return sql;
}

const price = (v) => Math.max(0, Math.round(Number(v || 0) * 100) / 100);

/* ---------- Límite de intentos ---------- */

// Devuelve true si la acción está permitida. Cuenta en la base de datos
// para que el límite se respete aunque Vercel use varias instancias.
export async function rateLimit(key, max, windowSeconds) {
  const sql = await db();
  if (!sql) {
    const now = Date.now();
    const cur = memory.limits.get(key);
    if (!cur || cur.reset < now) { memory.limits.set(key, { count: 1, reset: now + windowSeconds * 1000 }); return true; }
    cur.count += 1;
    return cur.count <= max;
  }
  const [{ count }] = await sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, NOW() + ${windowSeconds} * INTERVAL '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN NOW() + ${windowSeconds} * INTERVAL '1 second' ELSE rate_limits.reset_at END
    RETURNING count`;
  if (Math.random() < 0.02) sql`DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'`.catch(() => {});
  return count <= max;
}

/* ---------- Catálogo ---------- */

export async function getCatalog() {
  const sql = await db();
  if (!sql) {
    return {
      options: memory.options.filter((o) => o.active !== false && o.label),
      designs: memory.designs.filter((d) => d.active !== false),
      cakes: memory.cakes.filter((c) => c.active !== false).sort(bySort).map((c) => ({ ...c, image: c.image_url })),
      customCake: memory.settings.custom_cake !== "off",
    };
  }
  // Las fotos subidas (data URL) se sirven aparte por /api/img con caché;
  // así el catálogo pesa unos KB en lugar de varios MB.
  const options = await sql`SELECT id,category,label,description,price,price_on_request,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/option/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image
    FROM catalog_options WHERE active = true AND label <> '' ORDER BY id`;
  const designs = await sql`SELECT id,label,price,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/design/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image
    FROM designs WHERE active = true ORDER BY id`;
  const cakes = await sql`SELECT id,name,description,portions,size,frosting,price,options,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/cake/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image
    FROM cakes WHERE active = true ORDER BY sort, id`;
  const st = await sql`SELECT value FROM site_settings WHERE key = 'custom_cake'`;
  return { options, designs, cakes, customCake: st[0]?.value !== "off" };
}

export async function getFullCatalog() {
  const sql = await db();
  if (!sql) {
    return {
      options: memory.options, designs: memory.designs,
      cakes: [...memory.cakes].sort(bySort),
      sitePhotos: [...memory.sitePhotos].sort(bySort),
      settings: { custom_cake: memory.settings.custom_cake !== "off" },
    };
  }
  const options = await sql`SELECT * FROM catalog_options ORDER BY category, id`;
  const designs = await sql`SELECT * FROM designs ORDER BY id`;
  // Las fotos subidas se devuelven como enlace (no como data URL) para que el panel cargue rápido.
  const cakes = await sql`SELECT id,name,description,portions,size,frosting,price,options,active,sort,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/cake/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image_url
    FROM cakes ORDER BY sort, id`;
  const sitePhotos = await sql`SELECT id,section,caption_es,caption_en,sort,active,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/site/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image_url
    FROM site_photos ORDER BY section, sort, id`;
  const st = await sql`SELECT value FROM site_settings WHERE key = 'custom_cake'`;
  return { options, designs, cakes, sitePhotos, settings: { custom_cake: st[0]?.value !== "off" } };
}

const bySort = (a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id;
// El panel devuelve las fotos ya guardadas como enlace /api/img/...; si vuelve ese mismo enlace, la foto no cambió.
const keepsImage = (v) => typeof v === "string" && v.startsWith("/api/img/");
const userError = (msg) => Object.assign(new Error(msg), { userFacing: true });

/* ---------- Pasteles del catálogo ---------- */

// Personalizaciones sin costo: [{ name: "Color", choices: ["Rosa", "Azul"] }]
export function cleanCakeOptions(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const g of v.slice(0, 8)) {
    const name = String(g?.name || "").trim().slice(0, 40);
    const choices = [...new Set((Array.isArray(g?.choices) ? g.choices : []).map((c) => String(c || "").trim().slice(0, 60)).filter(Boolean))].slice(0, 20);
    if (name && choices.length && !out.some((x) => x.name === name)) out.push({ name, choices });
  }
  return out;
}

export async function upsertCake(row) {
  const clean = {
    name: String(row.name || "").trim().slice(0, 120),
    description: String(row.description || "").trim().slice(0, 600),
    portions: String(row.portions || "").trim().slice(0, 80),
    size: String(row.size || "").trim().slice(0, 80),
    frosting: String(row.frosting || "").trim().slice(0, 80),
    price: price(row.price),
    options: cleanCakeOptions(row.options),
    active: row.active !== false,
  };
  const image = row.image_url || row.image || "";
  if (!clean.name) throw new Error("El nombre del pastel es obligatorio");
  if (!(clean.price > 0)) throw new Error("El precio del pastel es obligatorio");
  if (!image) throw new Error("Agrega una foto del pastel");
  const sql = await db();
  if (!sql) {
    if (row.id) memory.cakes = memory.cakes.map((c) => (c.id === Number(row.id) ? { ...c, ...clean, image_url: keepsImage(image) ? c.image_url : image } : c));
    else { const id = memory.cakes.reduce((m, c) => Math.max(m, c.id), 0) + 1; memory.cakes.push({ ...clean, id, sort: id, image_url: image }); }
    return;
  }
  const opts = JSON.stringify(clean.options);
  if (row.id) {
    if (keepsImage(image)) {
      await sql`UPDATE cakes SET name=${clean.name}, description=${clean.description}, portions=${clean.portions}, size=${clean.size},
        frosting=${clean.frosting}, price=${clean.price}, options=${opts}::jsonb, active=${clean.active} WHERE id=${row.id}`;
    } else {
      await sql`UPDATE cakes SET name=${clean.name}, description=${clean.description}, portions=${clean.portions}, size=${clean.size},
        frosting=${clean.frosting}, price=${clean.price}, options=${opts}::jsonb, active=${clean.active}, image_url=${image} WHERE id=${row.id}`;
    }
  } else {
    if (keepsImage(image)) throw new Error("Agrega una foto del pastel");
    await sql`INSERT INTO cakes (name,description,portions,size,frosting,price,options,active,image_url,sort)
      VALUES (${clean.name},${clean.description},${clean.portions},${clean.size},${clean.frosting},${clean.price},${opts}::jsonb,${clean.active},${image},
        (SELECT COALESCE(MAX(sort), 0) + 1 FROM cakes))`;
  }
}

export async function deleteCake(id) {
  const sql = await db();
  if (!sql) { memory.cakes = memory.cakes.filter((c) => c.id !== id); return; }
  await sql`DELETE FROM cakes WHERE id=${id}`;
}

/* ---------- Personalizar web: fotos de la portada y ajustes ---------- */

// Fotos visibles de la portada, agrupadas por sección.
export async function getSitePhotos() {
  const sql = await db();
  const rows = !sql
    ? memory.sitePhotos.filter((p) => p.active !== false).sort(bySort).map((p) => ({ ...p, image: p.image_url }))
    : await sql`SELECT id,section,caption_es,caption_en,
        CASE WHEN image_url LIKE 'data:%' THEN '/api/img/site/' || id || '?v=' || left(md5(image_url), 10)
             ELSE image_url END AS image
      FROM site_photos WHERE active = true ORDER BY sort, id`;
  const out = { portada: [], novedades: [], talento: [] };
  for (const r of rows) if (out[r.section]) out[r.section].push({ id: r.id, src: r.image, es: r.caption_es || "", en: r.caption_en || r.caption_es || "" });
  return out;
}

export async function upsertSitePhoto(row) {
  if (!SITE_SECTIONS.includes(row.section)) throw new Error("Sección inválida");
  const clean = {
    section: row.section,
    caption_es: String(row.caption_es || "").trim().slice(0, 240),
    caption_en: String(row.caption_en || "").trim().slice(0, 240),
    active: row.active !== false,
  };
  const image = row.image_url || row.image || "";
  const sql = await db();
  if (!sql) {
    const endSort = memory.sitePhotos.reduce((m, p) => Math.max(m, p.sort || 0), 0) + 1;
    if (row.id) memory.sitePhotos = memory.sitePhotos.map((p) => (p.id === Number(row.id)
      ? { ...p, ...clean, sort: p.section !== clean.section ? endSort : p.sort, image_url: !image || keepsImage(image) ? p.image_url : image } : p));
    else {
      if (!image) throw new Error("Agrega una foto");
      const id = memory.sitePhotos.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      memory.sitePhotos.push({ ...clean, id, sort: memory.sitePhotos.reduce((m, p) => Math.max(m, p.sort || 0), 0) + 1, image_url: image });
    }
    return;
  }
  if (row.id) {
    if (!image || keepsImage(image)) {
      // Al cambiar de sección, la foto queda al final de la nueva sección.
      await sql`UPDATE site_photos SET caption_es=${clean.caption_es}, caption_en=${clean.caption_en}, active=${clean.active},
        sort = CASE WHEN section <> ${clean.section} THEN (SELECT COALESCE(MAX(sort), 0) + 1 FROM site_photos) ELSE sort END,
        section=${clean.section} WHERE id=${row.id}`;
    } else {
      await sql`UPDATE site_photos SET section=${clean.section}, caption_es=${clean.caption_es}, caption_en=${clean.caption_en}, active=${clean.active}, image_url=${image} WHERE id=${row.id}`;
    }
  } else {
    if (!image || keepsImage(image)) throw new Error("Agrega una foto");
    await sql`INSERT INTO site_photos (section,image_url,caption_es,caption_en,active,sort)
      VALUES (${clean.section},${image},${clean.caption_es},${clean.caption_en},${clean.active},(SELECT COALESCE(MAX(sort), 0) + 1 FROM site_photos))`;
  }
}

export async function deleteSitePhoto(id) {
  const sql = await db();
  if (!sql) { memory.sitePhotos = memory.sitePhotos.filter((p) => p.id !== id); return; }
  await sql`DELETE FROM site_photos WHERE id=${id}`;
}

// Sube o baja una foto dentro de su sección (dir: -1 antes, 1 después).
export async function moveSitePhoto(id, dir) {
  const sql = await db();
  const all = !sql ? [...memory.sitePhotos] : await sql`SELECT id, section, sort FROM site_photos`;
  const me = all.find((p) => p.id === id);
  if (!me) return;
  const list = all.filter((p) => p.section === me.section).sort(bySort);
  const i = list.findIndex((p) => p.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  // Se renumera la sección completa para que el orden quede siempre limpio.
  const base = Math.min(...list.map((p) => p.sort || 0));
  if (!sql) { list.forEach((p, k) => { memory.sitePhotos.find((x) => x.id === p.id).sort = base + k; }); return; }
  await sql.transaction(list.map((p, k) => sql`UPDATE site_photos SET sort=${base + k} WHERE id=${p.id}`));
}

export async function setSetting(key, value) {
  const sql = await db();
  if (!sql) { memory.settings[key] = value; return; }
  await sql`INSERT INTO site_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

export async function upsertOption(row) {
  const clean = {
    category: row.category,
    label: String(row.label || "").trim().slice(0, 120),
    description: String(row.description || "").slice(0, 300),
    price: price(row.price),
    image_url: row.image_url || row.image || "",
    active: row.active !== false,
    price_on_request: !!row.price_on_request,
  };
  if (!clean.label) throw new Error("El nombre es obligatorio");
  const sql = await db();
  if (!sql) {
    if (row.id) memory.options = memory.options.map((o) => (o.id === row.id ? { ...o, ...clean } : o));
    else memory.options.push({ ...clean, id: Date.now() });
    return;
  }
  if (row.id) {
    await sql`UPDATE catalog_options SET category=${clean.category}, label=${clean.label}, description=${clean.description},
      price=${clean.price}, image_url=${clean.image_url}, active=${clean.active}, price_on_request=${clean.price_on_request} WHERE id=${row.id}`;
  } else {
    await sql`INSERT INTO catalog_options (category,label,description,price,image_url,active,price_on_request)
      VALUES (${clean.category},${clean.label},${clean.description},${clean.price},${clean.image_url},${clean.active},${clean.price_on_request})`;
  }
}

export async function setCategoryActive(category, active) {
  const sql = await db();
  if (!sql) {
    memory.options = memory.options.map((o) => (o.category === category ? { ...o, active } : o));
    return;
  }
  await sql`UPDATE catalog_options SET active=${active} WHERE category=${category}`;
}

export async function deleteOption(id) {
  const sql = await db();
  if (!sql) { memory.options = memory.options.filter((o) => o.id !== id); return; }
  await sql`DELETE FROM catalog_options WHERE id=${id}`;
}

export async function addDesign(row) {
  const label = String(row.label || "").trim().slice(0, 120);
  const image = row.image_url || row.image || "";
  if (!label) throw new Error("El nombre del diseño es obligatorio");
  if (!image) throw new Error("Agrega una foto del diseño");
  const sql = await db();
  if (!sql) { memory.designs.push({ id: Date.now(), label, image, image_url: image, price: price(row.price), active: row.active !== false }); return; }
  await sql`INSERT INTO designs (label,image_url,price,active) VALUES (${label},${image},${price(row.price)},${row.active !== false})`;
}

export async function updateDesign(row) {
  const label = String(row.label || "").trim().slice(0, 120);
  if (!label) throw new Error("El nombre del diseño es obligatorio");
  const image = row.image_url || row.image || "";
  const sql = await db();
  if (!sql) {
    memory.designs = memory.designs.map((d) => (d.id === row.id ? { ...d, label, image, image_url: image, price: price(row.price), active: row.active !== false } : d));
    return;
  }
  await sql`UPDATE designs SET label=${label}, image_url=${image}, price=${price(row.price)}, active=${row.active !== false} WHERE id=${row.id}`;
}

export async function deleteDesign(id) {
  const sql = await db();
  if (!sql) { memory.designs = memory.designs.filter((d) => d.id !== id); return; }
  await sql`DELETE FROM designs WHERE id=${id}`;
}

export async function getImage(kind, id) {
  const sql = await db();
  if (!sql) {
    const list = { design: memory.designs, cake: memory.cakes, site: memory.sitePhotos }[kind] || memory.options;
    const row = list.find((x) => String(x.id) === String(id));
    return row ? row.image_url || row.image || null : null;
  }
  const rows = kind === "design" ? await sql`SELECT image_url FROM designs WHERE id=${id}`
    : kind === "cake" ? await sql`SELECT image_url FROM cakes WHERE id=${id}`
    : kind === "site" ? await sql`SELECT image_url FROM site_photos WHERE id=${id}`
    : await sql`SELECT image_url FROM catalog_options WHERE id=${id}`;
  return rows[0]?.image_url || null;
}

/* ---------- Pedidos ---------- */

// El precio se calcula en el servidor con el catálogo real;
// el total que manda el navegador no se usa. Las opciones marcadas
// "precio a confirmar" (decoración premium, envío a domicilio) no suman:
// quedan pendientes hasta que Karla ponga el precio final.
export async function priceOrder(p) {
  const { options, designs, cakes, customCake } = await getCatalog();
  const pick = (cat, label) => options.find((o) => o.category === cat && o.label === label);
  let total = 0;
  let cake = null;
  const pending = [];
  if (options.some((o) => o.category === "delivery") && !p.deliveryType) throw userError("Elige envío o recogida.");
  const lines = [["delivery", p.deliveryType]];
  if (p.cakeId) {
    // Pastel del catálogo: precio fijo y personalizaciones sin costo.
    const c = cakes.find((x) => String(x.id) === String(p.cakeId));
    if (!c) throw userError("El pastel elegido ya no está disponible. Recarga la página.");
    const chosen = [];
    for (const g of c.options || []) {
      const v = p.cakeOptions?.[g.name];
      if (!g.choices.includes(v)) throw userError(`Elige una opción de "${g.name}".`);
      chosen.push(`${g.name}: ${v}`);
    }
    total += Number(c.price || 0);
    cake = { id: c.id, name: c.name, details: [c.size, c.portions, c.frosting].filter(Boolean).join(" · "), optionsText: chosen.join(" · ") };
  } else {
    if (cakes.length && !customCake) throw userError("Elige un pastel del catálogo.");
    lines.push(["size", p.size], ["cake_flavor", p.cakeFlavor], ["filling", p.fillingFlavor],
      ["filling_count", p.fillingCountLabel], ["decoration", p.decorationLabel]);
  }
  for (const [cat, label] of lines) {
    if (!label) continue;
    const o = pick(cat, label);
    if (!o) throw userError("Una de las opciones elegidas ya no está disponible. Recarga la página.");
    if (o.price_on_request) pending.push(o.label);
    else total += Number(o.price || 0);
  }
  if (!cake && p.designId) {
    const d = designs.find((x) => String(x.id) === String(p.designId));
    if (!d) throw userError("El diseño elegido ya no está disponible. Recarga la página.");
    total += Number(d.price || 0);
  }
  return { total: price(total), pending, cake };
}

const pad = (n) => "KAKE-" + String(n).padStart(4, "0");

// Si el cliente reintenta (doble clic, mala señal), devolvemos el pedido ya creado.
export async function findByClientRef(ref) {
  if (!ref) return null;
  const sql = await db();
  if (!sql) return memory.orders.find((o) => o.client_ref === ref) || null;
  const rows = await sql`SELECT id, order_number, total, status FROM orders WHERE client_ref=${ref}`;
  return rows[0] || null;
}

// confirmed: pedido sin nada por confirmar (sin envío ni decoración premium);
// queda CONFIRMADO de una vez, con su anticipo calculado.
export async function createOrder(p, total, pending = [], { confirmed = false, deposit = null, cake = null } = {}) {
  const c = p.customer;
  const fillingCount = /^\s*(\d+)/.exec(p.fillingCountLabel || "")?.[1];
  const fc = fillingCount ? Number(fillingCount) : null;
  const pricePending = pending.length > 0;
  const pendingItems = pending.join(", ");
  const photos = p.decorationPhotos || [];
  const sql = await db();
  if (!sql) {
    const n = memory.orders.length + 1;
    const orderNumber = pad(n);
    memory.orders.unshift({
      id: n, order_number: orderNumber, client_ref: p.clientRef, customer_name: c.name, phone: c.phone, email: c.email,
      sms_opt_in: c.smsOptIn, delivery_type: p.deliveryType, delivery_address: p.deliveryAddress, delivery_date: p.deliveryDate,
      delivery_time: p.deliveryTime, size_label: p.size, cake_flavor: p.cakeFlavor, filling_flavor: p.fillingFlavor,
      filling_count: fc, design_label: p.designLabel, design_notes: p.designNotes, design_image: p.designImage,
      decoration_label: p.decorationLabel, decoration_notes: p.decorationNotes, lang: p.lang,
      price_pending: pricePending, pending_items: pendingItems,
      cake_id: cake?.id || null, cake_name: cake?.name || "", cake_details: cake?.details || "", cake_options: cake?.optionsText || "",
      total, status: confirmed ? "confirmado" : "nuevo", paid_amount: 0, ordered_at: new Date().toISOString(),
      ...(confirmed ? { final_total: total, deposit_amount: deposit, price_confirmed_at: new Date().toISOString(),
        customer_confirmed_at: new Date().toISOString(), status_updated_at: new Date().toISOString() } : {}),
    });
    photos.forEach((img, i) => memory.photos.push({ id: memory.photos.length + 1, order_id: n, kind: "decoration", image: img }));
    return { orderId: n, orderNumber };
  }
  // nextval es atómico: dos pedidos simultáneos nunca comparten número.
  const [{ n }] = await sql`SELECT nextval(pg_get_serial_sequence('orders','id'))::int AS n`;
  const orderNumber = pad(n);
  // Cliente, pedido y fotos en una sola transacción: o se guarda todo o nada.
  await sql.transaction([
    sql`
    WITH cust AS (
      INSERT INTO customers (name,phone,email,address,sms_opt_in)
      VALUES (${c.name},${c.phone},${c.email},${c.address || ""},${!!c.smsOptIn})
      RETURNING id
    )
    INSERT INTO orders (
      id, order_number, client_ref, customer_id, customer_name, delivery_type, delivery_address,
      delivery_date, delivery_time, size_label, cake_flavor, filling_flavor,
      filling_count, design_label, design_image, design_notes, selections, total, status,
      lang, decoration_label, decoration_notes, price_pending, pending_items,
      cake_id, cake_name, cake_details, cake_options,
      final_total, deposit_amount, price_confirmed_at, customer_confirmed_at, status_updated_at
    )
    SELECT ${n}, ${orderNumber}, ${p.clientRef || null}, cust.id, ${c.name}, ${p.deliveryType || ""},
      ${p.deliveryAddress || ""}, ${p.deliveryDate}, ${p.deliveryTime},
      ${p.size || ""}, ${p.cakeFlavor || ""}, ${p.fillingFlavor || ""},
      ${fc}, ${p.designLabel || ""}, ${p.designImage || ""},
      ${p.designNotes || ""}, ${JSON.stringify({ lang: p.lang, designId: p.designId || null, cakeId: cake?.id || null, cakeOptions: cake ? p.cakeOptions || {} : null })},
      ${total}, ${confirmed ? "confirmado" : "nuevo"},
      ${p.lang}, ${p.decorationLabel || ""}, ${p.decorationNotes || ""}, ${pricePending}, ${pendingItems},
      ${cake?.id || null}::int, ${cake?.name || ""}, ${cake?.details || ""}, ${cake?.optionsText || ""},
      ${confirmed ? total : null}::numeric, ${confirmed ? deposit : null}::numeric,
      CASE WHEN ${confirmed}::boolean THEN NOW() END, CASE WHEN ${confirmed}::boolean THEN NOW() END, CASE WHEN ${confirmed}::boolean THEN NOW() END
    FROM cust`,
    ...photos.map((img) => sql`INSERT INTO order_photos (order_id, kind, image) VALUES (${n}, 'decoration', ${img})`),
  ]);
  return { orderId: n, orderNumber };
}

// Lista para el panel: sin fotos (se cargan aparte al abrir cada pedido).
export async function listOrders() {
  const sql = await db();
  if (!sql) {
    return memory.orders.map(({ design_image, payment_proof, ...o }) => ({
      ...o, has_design_image: !!design_image, has_payment_proof: !!payment_proof,
      photo_ids: memory.photos.filter((ph) => ph.order_id === o.id).map((ph) => ph.id),
    }));
  }
  return sql`SELECT o.id, o.order_number, o.customer_name, c.phone, c.email, c.sms_opt_in,
      o.delivery_type, o.delivery_address, to_char(o.delivery_date, 'YYYY-MM-DD') AS delivery_date, o.delivery_time,
      o.size_label, o.cake_flavor, o.filling_flavor, o.filling_count,
      o.design_label, COALESCE(o.design_notes, o.selections->>'designNotes') AS design_notes,
      (COALESCE(o.design_image, '') <> '') AS has_design_image,
      o.total, o.final_total, o.status, o.status_updated_at,
      o.paid_amount, to_char(o.paid_at, 'YYYY-MM-DD') AS paid_at, o.payment_method, o.payment_note,
      (COALESCE(o.payment_proof, '') <> '') AS has_payment_proof,
      md5(COALESCE(o.payment_proof, '') || COALESCE(o.design_image, '')) AS img_version,
      o.ordered_at, o.lang, o.decoration_label, o.decoration_notes, o.price_pending, o.pending_items,
      o.price_confirmed_at, o.customer_confirmed_at, o.deposit_amount,
      o.cake_id, o.cake_name, o.cake_details, o.cake_options,
      (SELECT COALESCE(array_agg(ph.id ORDER BY ph.id), '{}') FROM order_photos ph WHERE ph.order_id = o.id) AS photo_ids
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
    ORDER BY o.ordered_at DESC LIMIT 500`;
}

export async function getOrderImage(id, kind) {
  const sql = await db();
  if (!sql) {
    const o = memory.orders.find((x) => String(x.id) === String(id));
    return o ? (kind === "proof" ? o.payment_proof : o.design_image) || null : null;
  }
  const rows = kind === "proof"
    ? await sql`SELECT payment_proof AS img FROM orders WHERE id=${id}`
    : await sql`SELECT design_image AS img FROM orders WHERE id=${id}`;
  return rows[0]?.img || null;
}

// Cambios del panel: estado y/o cobro. Solo se tocan los campos enviados.
export async function updateOrder(id, u) {
  const sql = await db();
  if (!sql) {
    const o = memory.orders.find((x) => String(x.id) === String(id));
    if (!o) return false;
    if (u.status) Object.assign(o, { status: u.status, status_updated_at: new Date().toISOString() });
    if (u.payment) {
      const p = u.payment;
      Object.assign(o, {
        final_total: p.finalTotal, paid_amount: p.amount, paid_at: p.date, payment_method: p.method, payment_note: p.note,
        ...(p.proof !== undefined ? { payment_proof: p.proof } : {}),
      });
    }
    return true;
  }
  let found = true;
  if (u.status) {
    const r = await sql`UPDATE orders SET status=${u.status}, status_updated_at=NOW() WHERE id=${id} RETURNING id`;
    found = r.length > 0;
  }
  if (found && u.payment) {
    const p = u.payment;
    const r = p.proof !== undefined
      ? await sql`UPDATE orders SET final_total=${p.finalTotal}, paid_amount=${p.amount}, paid_at=${p.date},
          payment_method=${p.method}, payment_note=${p.note}, payment_proof=${p.proof}, payment_updated_at=NOW()
          WHERE id=${id} RETURNING id`
      : await sql`UPDATE orders SET final_total=${p.finalTotal}, paid_amount=${p.amount}, paid_at=${p.date},
          payment_method=${p.method}, payment_note=${p.note}, payment_updated_at=NOW()
          WHERE id=${id} RETURNING id`;
    found = r.length > 0;
  }
  return found;
}

/* ---------- Confirmación por correo ---------- */

// Un pedido con los datos necesarios para las páginas de confirmación (sin fotos pesadas).
export async function getOrderSummary(id) {
  const sql = await db();
  if (!sql) {
    const o = memory.orders.find((x) => x.id === id);
    if (!o) return null;
    const { design_image, payment_proof, ...rest } = o;
    return { ...rest, has_design_image: !!design_image, photo_ids: memory.photos.filter((ph) => ph.order_id === id).map((ph) => ph.id) };
  }
  const rows = await sql`SELECT o.id, o.order_number, o.customer_name, c.phone, c.email, o.lang,
      o.delivery_type, o.delivery_address, to_char(o.delivery_date, 'YYYY-MM-DD') AS delivery_date, o.delivery_time,
      o.size_label, o.cake_flavor, o.filling_flavor, o.filling_count, o.design_label, o.design_notes,
      (COALESCE(o.design_image, '') <> '') AS has_design_image,
      o.decoration_label, o.decoration_notes, o.price_pending, o.pending_items,
      o.total, o.final_total, o.deposit_amount, o.status, o.price_confirmed_at, o.customer_confirmed_at,
      o.paid_amount, o.checkout_session_id, o.cake_id, o.cake_name, o.cake_details, o.cake_options,
      (SELECT COALESCE(array_agg(ph.id ORDER BY ph.id), '{}') FROM order_photos ph WHERE ph.order_id = o.id) AS photo_ids
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ${id}`;
  return rows[0] || null;
}

export async function getOrderPhoto(orderId, photoId) {
  const sql = await db();
  if (!sql) return memory.photos.find((ph) => ph.order_id === orderId && ph.id === photoId)?.image || null;
  const rows = await sql`SELECT image FROM order_photos WHERE id = ${photoId} AND order_id = ${orderId}`;
  return rows[0]?.image || null;
}

// Fotos de decoración en base64 (para adjuntarlas en el correo a Karla).
export async function getOrderPhotos(orderId) {
  const sql = await db();
  if (!sql) return memory.photos.filter((ph) => ph.order_id === orderId).map((ph) => ph.image);
  const rows = await sql`SELECT image FROM order_photos WHERE order_id = ${orderId} ORDER BY id`;
  return rows.map((r) => r.image);
}

// Karla confirma el pedido con su precio final.
// Si el precio estaba por confirmar o lo cambió, el cliente debe aprobarlo;
// si no, el pedido queda CONFIRMADO de inmediato.
export async function karlaConfirm(id, finalTotal, deposit, needsCustomer) {
  const sql = await db();
  if (!sql) {
    const o = memory.orders.find((x) => x.id === id);
    if (!o || o.status !== "nuevo" || o.customer_confirmed_at) return false;
    Object.assign(o, {
      final_total: finalTotal, deposit_amount: deposit, price_confirmed_at: new Date().toISOString(),
      ...(needsCustomer ? {} : { status: "confirmado", customer_confirmed_at: new Date().toISOString(), status_updated_at: new Date().toISOString() }),
    });
    return true;
  }
  const r = needsCustomer
    ? await sql`UPDATE orders SET final_total=${finalTotal}, deposit_amount=${deposit}, price_confirmed_at=NOW()
        WHERE id=${id} AND status='nuevo' AND customer_confirmed_at IS NULL RETURNING id`
    : await sql`UPDATE orders SET final_total=${finalTotal}, deposit_amount=${deposit}, price_confirmed_at=NOW(),
        customer_confirmed_at=NOW(), status='confirmado', status_updated_at=NOW()
        WHERE id=${id} AND status='nuevo' AND customer_confirmed_at IS NULL RETURNING id`;
  return r.length > 0;
}

// El cliente aprueba el precio final: el pedido pasa a CONFIRMADO.
export async function customerConfirm(id) {
  const sql = await db();
  if (!sql) {
    const o = memory.orders.find((x) => x.id === id);
    if (!o || o.status !== "nuevo" || !o.price_confirmed_at || o.customer_confirmed_at) return false;
    Object.assign(o, { status: "confirmado", customer_confirmed_at: new Date().toISOString(), status_updated_at: new Date().toISOString() });
    return true;
  }
  const r = await sql`UPDATE orders SET status='confirmado', customer_confirmed_at=NOW(), status_updated_at=NOW()
    WHERE id=${id} AND status='nuevo' AND price_confirmed_at IS NOT NULL AND customer_confirmed_at IS NULL RETURNING id`;
  return r.length > 0;
}

// Guarda la sesión de Checkout abierta para reutilizarla si el cliente vuelve a pulsar "Pagar".
export async function setCheckoutSession(id, sessionId) {
  const sql = await db();
  if (!sql) {
    const o = memory.orders.find((x) => x.id === id);
    if (o) o.checkout_session_id = sessionId;
    return;
  }
  await sql`UPDATE orders SET checkout_session_id = ${sessionId} WHERE id = ${id}`;
}

// Registra un pago en línea. Devuelve true solo la primera vez (idempotente por session_id).
export async function recordOnlinePayment({ orderId, sessionId, paymentIntent, amount }) {
  const note = `Pago en línea (Stripe) · ${paymentIntent || sessionId}`;
  const sql = await db();
  if (!sql) {
    memory.payments = memory.payments || [];
    if (memory.payments.some((p) => p.session_id === sessionId)) return false;
    const o = memory.orders.find((x) => x.id === orderId);
    if (!o) return false;
    memory.payments.push({ order_id: orderId, session_id: sessionId, amount });
    Object.assign(o, {
      paid_amount: Number(o.paid_amount || 0) + amount, paid_at: todayInTexas(), payment_method: "tarjeta",
      payment_note: note, payment_updated_at: new Date().toISOString(),
    });
    return true;
  }
  const r = await sql`WITH ins AS (
      INSERT INTO online_payments (order_id, session_id, payment_intent, amount)
      VALUES (${orderId}, ${sessionId}, ${paymentIntent || null}, ${amount})
      ON CONFLICT (session_id) DO NOTHING
      RETURNING order_id, amount
    )
    UPDATE orders o SET paid_amount = o.paid_amount + ins.amount,
      paid_at = (NOW() AT TIME ZONE 'America/Chicago')::date,
      payment_method = 'tarjeta', payment_note = ${note}, payment_updated_at = NOW()
    FROM ins WHERE o.id = ins.order_id RETURNING o.id`;
  return r.length > 0;
}
