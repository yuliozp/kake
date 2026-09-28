import { neon } from "@neondatabase/serverless";
import { defaultCatalog } from "./defaults";

// Respaldo en memoria para desarrollo local sin DATABASE_URL.
const memory = {
  orders: [],
  options: JSON.parse(JSON.stringify(defaultCatalog.options)),
  designs: JSON.parse(JSON.stringify(defaultCatalog.designs)),
  limits: new Map(),
};

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
    ADD COLUMN IF NOT EXISTS payment_updated_at TIMESTAMPTZ`;
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
  await sql`CREATE TABLE IF NOT EXISTS designs (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    image_url TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
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
    };
  }
  // Las fotos subidas (data URL) se sirven aparte por /api/img con caché;
  // así el catálogo pesa unos KB en lugar de varios MB.
  const options = await sql`SELECT id,category,label,description,price,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/option/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image
    FROM catalog_options WHERE active = true AND label <> '' ORDER BY id`;
  const designs = await sql`SELECT id,label,price,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/design/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image
    FROM designs WHERE active = true ORDER BY id`;
  return { options, designs };
}

export async function getFullCatalog() {
  const sql = await db();
  if (!sql) return { options: memory.options, designs: memory.designs };
  const options = await sql`SELECT * FROM catalog_options ORDER BY category, id`;
  const designs = await sql`SELECT * FROM designs ORDER BY id`;
  return { options, designs };
}

export async function upsertOption(row) {
  const clean = {
    category: row.category,
    label: String(row.label || "").trim().slice(0, 120),
    description: String(row.description || "").slice(0, 300),
    price: price(row.price),
    image_url: row.image_url || row.image || "",
    active: row.active !== false,
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
      price=${clean.price}, image_url=${clean.image_url}, active=${clean.active} WHERE id=${row.id}`;
  } else {
    await sql`INSERT INTO catalog_options (category,label,description,price,image_url,active)
      VALUES (${clean.category},${clean.label},${clean.description},${clean.price},${clean.image_url},${clean.active})`;
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
    const list = kind === "design" ? memory.designs : memory.options;
    const row = list.find((x) => String(x.id) === String(id));
    return row ? row.image_url || row.image || null : null;
  }
  const rows = kind === "design"
    ? await sql`SELECT image_url FROM designs WHERE id=${id}`
    : await sql`SELECT image_url FROM catalog_options WHERE id=${id}`;
  return rows[0]?.image_url || null;
}

/* ---------- Pedidos ---------- */

// El precio se calcula en el servidor con el catálogo real;
// el total que manda el navegador no se usa.
export async function priceOrder(p) {
  const { options, designs } = await getCatalog();
  const pick = (cat, label) => options.find((o) => o.category === cat && o.label === label);
  const lines = [
    ["size", p.size],
    ["cake_flavor", p.cakeFlavor],
    ["filling", p.fillingFlavor],
    ["filling_count", p.fillingCountLabel],
    ["delivery", p.deliveryType],
  ];
  let total = 0;
  for (const [cat, label] of lines) {
    if (!label) continue;
    const o = pick(cat, label);
    if (!o) throw new Error("Una de las opciones elegidas ya no está disponible. Recarga la página.");
    total += Number(o.price || 0);
  }
  if (p.designId) {
    const d = designs.find((x) => String(x.id) === String(p.designId));
    if (!d) throw new Error("El diseño elegido ya no está disponible. Recarga la página.");
    total += Number(d.price || 0);
  }
  return price(total);
}

const pad = (n) => "KAKE-" + String(n).padStart(4, "0");

// Si el cliente reintenta (doble clic, mala señal), devolvemos el pedido ya creado.
export async function findByClientRef(ref) {
  if (!ref) return null;
  const sql = await db();
  if (!sql) return memory.orders.find((o) => o.client_ref === ref) || null;
  const rows = await sql`SELECT order_number, total FROM orders WHERE client_ref=${ref}`;
  return rows[0] || null;
}

export async function createOrder(p, total) {
  const c = p.customer;
  const fillingCount = /^\s*(\d+)/.exec(p.fillingCountLabel || "")?.[1];
  const fc = fillingCount ? Number(fillingCount) : null;
  const sql = await db();
  if (!sql) {
    const n = memory.orders.length + 1;
    const orderNumber = pad(n);
    memory.orders.unshift({
      id: n, order_number: orderNumber, client_ref: p.clientRef, customer_name: c.name, phone: c.phone, email: c.email,
      sms_opt_in: c.smsOptIn, delivery_type: p.deliveryType, delivery_address: p.deliveryAddress, delivery_date: p.deliveryDate,
      delivery_time: p.deliveryTime, size_label: p.size, cake_flavor: p.cakeFlavor, filling_flavor: p.fillingFlavor,
      filling_count: fc, design_label: p.designLabel, design_notes: p.designNotes, design_image: p.designImage,
      total, status: "nuevo", paid_amount: 0, ordered_at: new Date().toISOString(),
    });
    return { orderNumber };
  }
  // nextval es atómico: dos pedidos simultáneos nunca comparten número.
  const [{ n }] = await sql`SELECT nextval(pg_get_serial_sequence('orders','id'))::int AS n`;
  const orderNumber = pad(n);
  // Cliente y pedido en una sola sentencia: o se guardan los dos o ninguno.
  await sql`
    WITH cust AS (
      INSERT INTO customers (name,phone,email,address,sms_opt_in)
      VALUES (${c.name},${c.phone},${c.email},${c.address || ""},${!!c.smsOptIn})
      RETURNING id
    )
    INSERT INTO orders (
      id, order_number, client_ref, customer_id, customer_name, delivery_type, delivery_address,
      delivery_date, delivery_time, size_label, cake_flavor, filling_flavor,
      filling_count, design_label, design_image, design_notes, selections, total, status
    )
    SELECT ${n}, ${orderNumber}, ${p.clientRef || null}, cust.id, ${c.name}, ${p.deliveryType || ""},
      ${p.deliveryAddress || ""}, ${p.deliveryDate}, ${p.deliveryTime},
      ${p.size || ""}, ${p.cakeFlavor || ""}, ${p.fillingFlavor || ""},
      ${fc}, ${p.designLabel || ""}, ${p.designImage || ""},
      ${p.designNotes || ""}, ${JSON.stringify({ lang: p.lang, designId: p.designId || null })}, ${total}, 'nuevo'
    FROM cust`;
  return { orderNumber };
}

// Lista para el panel: sin fotos (se cargan aparte al abrir cada pedido).
export async function listOrders() {
  const sql = await db();
  if (!sql) {
    return memory.orders.map(({ design_image, payment_proof, ...o }) => ({
      ...o, has_design_image: !!design_image, has_payment_proof: !!payment_proof,
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
      o.ordered_at
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
