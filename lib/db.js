import { neon } from "@neondatabase/serverless";
import { defaultCatalog } from "./defaults";

// Respaldo en memoria para desarrollo local sin DATABASE_URL.
const memory = {
  customers: [],
  orders: [],
  options: JSON.parse(JSON.stringify(defaultCatalog.options)),
  designs: JSON.parse(JSON.stringify(defaultCatalog.designs)),
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
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS design_notes TEXT`;
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

const money = (v) => Math.max(0, Math.round(Number(v || 0) * 100) / 100);

/* ---------- Catálogo ---------- */

export async function getCatalog() {
  const sql = await db();
  if (!sql) {
    return {
      options: memory.options.filter((o) => o.active !== false),
      designs: memory.designs.filter((d) => d.active !== false),
    };
  }
  // Las fotos subidas (data URL) se sirven aparte por /api/img con caché;
  // así el catálogo pesa unos KB en lugar de varios MB.
  const options = await sql`SELECT id,category,label,description,price,
      CASE WHEN image_url LIKE 'data:%' THEN '/api/img/option/' || id || '?v=' || left(md5(image_url), 10)
           ELSE image_url END AS image
    FROM catalog_options WHERE active = true ORDER BY id`;
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
    category: String(row.category || "").slice(0, 40),
    label: String(row.label || "").trim().slice(0, 120),
    description: String(row.description || "").slice(0, 300),
    price: money(row.price),
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
  if (!sql) { memory.designs.push({ id: Date.now(), label, image, image_url: image, price: money(row.price), active: true }); return; }
  await sql`INSERT INTO designs (label,image_url,price,active) VALUES (${label},${image},${money(row.price)},true)`;
}

export async function updateDesign(row) {
  const label = String(row.label || "").trim().slice(0, 120);
  if (!label) throw new Error("El nombre del diseño es obligatorio");
  const image = row.image_url || row.image || "";
  const sql = await db();
  if (!sql) {
    memory.designs = memory.designs.map((d) => (d.id === row.id ? { ...d, label, image, image_url: image, price: money(row.price), active: row.active !== false } : d));
    return;
  }
  await sql`UPDATE designs SET label=${label}, image_url=${image}, price=${money(row.price)}, active=${row.active !== false} WHERE id=${row.id}`;
}

export async function deleteDesign(id) {
  const sql = await db();
  if (!sql) { memory.designs = memory.designs.filter((d) => d.id !== id); return; }
  await sql`DELETE FROM designs WHERE id=${id}`;
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
  return money(total);
}

const pad = (n) => "KAKE-" + String(n).padStart(4, "0");

export async function createOrder(p, total) {
  const c = p.customer;
  const sms = !!c.smsOptIn;
  const fillingCount = /^\s*(\d+)/.exec(p.fillingCountLabel || "")?.[1];
  const sql = await db();
  if (!sql) {
    const n = memory.orders.length + 1;
    const orderNumber = pad(n);
    const customer = { id: Date.now(), ...c, sms_opt_in: sms };
    memory.customers.push(customer);
    memory.orders.unshift({
      id: n, order_number: orderNumber, customer_name: c.name, phone: c.phone, email: c.email, sms_opt_in: sms,
      delivery_type: p.deliveryType, delivery_address: p.deliveryAddress, delivery_date: p.deliveryDate,
      delivery_time: p.deliveryTime, size_label: p.size, cake_flavor: p.cakeFlavor, filling_flavor: p.fillingFlavor,
      filling_count: fillingCount ? Number(fillingCount) : null, design_label: p.designLabel, design_notes: p.designNotes,
      design_image: p.designImage, total, ordered_at: new Date().toISOString(),
    });
    return { orderNumber };
  }
  // nextval es atómico: dos pedidos simultáneos nunca comparten número.
  const [{ n }] = await sql`SELECT nextval(pg_get_serial_sequence('orders','id'))::int AS n`;
  const orderNumber = pad(n);
  const [cust] = await sql`INSERT INTO customers (name,phone,email,address,sms_opt_in)
    VALUES (${c.name},${c.phone},${c.email},${c.address || ""},${sms}) RETURNING id`;
  await sql`INSERT INTO orders (
    id, order_number, customer_id, customer_name, delivery_type, delivery_address,
    delivery_date, delivery_time, size_label, cake_flavor, filling_flavor,
    filling_count, design_label, design_image, design_notes, selections, total
  ) VALUES (
    ${n}, ${orderNumber}, ${cust.id}, ${c.name}, ${p.deliveryType || ""},
    ${p.deliveryAddress || ""}, ${p.deliveryDate}, ${p.deliveryTime},
    ${p.size || ""}, ${p.cakeFlavor || ""}, ${p.fillingFlavor || ""},
    ${fillingCount ? Number(fillingCount) : null}, ${p.designLabel || ""}, ${p.designImage || ""},
    ${p.designNotes || ""}, ${JSON.stringify({ lang: p.lang, designId: p.designId || null })}, ${total}
  )`;
  return { orderNumber };
}

export async function listOrders() {
  const sql = await db();
  if (!sql) return memory.orders;
  return sql`SELECT o.id, o.order_number, o.customer_name, c.phone, c.email, c.sms_opt_in,
      o.delivery_type, o.delivery_address, o.delivery_date, o.delivery_time,
      o.size_label, o.cake_flavor, o.filling_flavor, o.filling_count,
      o.design_label, o.design_image, COALESCE(o.design_notes, o.selections->>'designNotes') AS design_notes,
      o.total, o.ordered_at
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
    ORDER BY o.ordered_at DESC LIMIT 200`;
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
