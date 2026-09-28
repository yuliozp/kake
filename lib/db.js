import { neon } from "@neondatabase/serverless";
import { defaultCatalog, IMAGES } from "./defaults";

let memory = {
  customers: [],
  orders: [],
  catalog: JSON.parse(JSON.stringify(defaultCatalog)),
  designs: defaultCatalog.designs,
};

function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export async function ensureSchema() {
  const sql = sqlClient();
  if (!sql) return false;
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
        VALUES (${o.category},${o.label},${o.description||""},${o.price},${o.image||""},true)`;
    }
  }
  const [{ d }] = await sql`SELECT COUNT(*)::int AS d FROM designs`;
  if (d === 0) {
    for (const o of defaultCatalog.designs) {
      await sql`INSERT INTO designs (label,image_url,price,active)
        VALUES (${o.label},${o.image},${o.price},true)`;
    }
  }
  return true;
}

export async function getCatalog() {
  const sql = sqlClient();
  if (!sql) return { options: memory.catalog.options, designs: memory.designs };
  await ensureSchema();
  const options = await sql`SELECT * FROM catalog_options WHERE active = true ORDER BY id`;
  const designs = await sql`SELECT id,label,image_url as image,price FROM designs WHERE active = true ORDER BY id`;
  return { options, designs };
}

export async function getFullCatalog() {
  const sql = sqlClient();
  if (!sql) return { options: memory.catalog.options, designs: memory.designs };
  await ensureSchema();
  const options = await sql`SELECT * FROM catalog_options ORDER BY id`;
  const designs = await sql`SELECT * FROM designs ORDER BY id`;
  return { options, designs };
}

export async function upsertOption(row) {
  const sql = sqlClient();
  if (!sql) {
    if (row.id) memory.catalog.options = memory.catalog.options.map((o) => (o.id === row.id ? { ...o, ...row } : o));
    else memory.catalog.options.push({ ...row, id: Date.now() });
    return;
  }
  await ensureSchema();
  if (row.id) {
    await sql`UPDATE catalog_options SET category=${row.category}, label=${row.label}, description=${row.description||""},
      price=${row.price||0}, image_url=${row.image_url||row.image||""}, active=${row.active!==false} WHERE id=${row.id}`;
  } else {
    await sql`INSERT INTO catalog_options (category,label,description,price,image_url)
      VALUES (${row.category},${row.label},${row.description||""},${row.price||0},${row.image_url||row.image||""})`;
  }
}

export async function addDesign(row) {
  const sql = sqlClient();
  if (!sql) { memory.designs.push({ id: Date.now(), ...row }); return; }
  await ensureSchema();
  await sql`INSERT INTO designs (label,image_url,price,active) VALUES (${row.label},${row.image_url||row.image},${row.price||0},true)`;
}

export async function updateDesign(row) {
  const sql = sqlClient();
  if (!sql) { memory.designs = memory.designs.map((d) => (d.id === row.id ? { ...d, ...row } : d)); return; }
  await ensureSchema();
  await sql`UPDATE designs SET label=${row.label}, image_url=${row.image_url||row.image}, price=${row.price||0}, active=${row.active!==false} WHERE id=${row.id}`;
}

export async function deleteDesign(id) {
  const sql = sqlClient();
  if (!sql) { memory.designs = memory.designs.filter((d) => d.id !== id); return; }
  await ensureSchema();
  await sql`DELETE FROM designs WHERE id=${id}`;
}

export async function createOrder(payload) {
  const sql = sqlClient();
  const sms = !!payload.customer?.smsOptIn;
  if (!sql) {
    const n = memory.orders.length + 1;
    const orderNumber = "KAKE-" + String(n).padStart(4, "0");
    const customer = { id: Date.now(), ...payload.customer, sms_opt_in: sms };
    memory.customers.push(customer);
    const order = { id: n, order_number: orderNumber, customer_id: customer.id, ...payload };
    memory.orders.push(order);
    return { orderNumber, customerId: customer.id, ticketNumber: n };
  }
  await ensureSchema();
  const [{ n }] = await sql`SELECT COALESCE(MAX(id),0)+1 AS n FROM orders`;
  const orderNumber = "KAKE-" + String(n).padStart(4, "0");
  const [cust] = await sql`INSERT INTO customers (name,phone,email,address,sms_opt_in)
    VALUES (${payload.customer.name},${payload.customer.phone},${payload.customer.email},${payload.customer.address||""},${sms})
    RETURNING id`;
  await sql`INSERT INTO orders (
    order_number, customer_id, customer_name, delivery_type, delivery_address,
    delivery_date, delivery_time, size_label, cake_flavor, filling_flavor,
    filling_count, design_label, design_image, selections, total
  ) VALUES (
    ${orderNumber}, ${cust.id}, ${payload.customer.name}, ${payload.deliveryType},
    ${payload.deliveryAddress||""}, ${payload.deliveryDate}, ${payload.deliveryTime},
    ${payload.size}, ${payload.cakeFlavor}, ${payload.fillingFlavor},
    ${payload.fillingCount}, ${payload.designLabel||""}, ${payload.designImage||""},
    ${JSON.stringify(payload.selections||{})}, ${payload.total||0}
  )`;
  return { orderNumber, customerId: cust.id, ticketNumber: n };
}

export async function listOrders() {
  const sql = sqlClient();
  if (!sql) return memory.orders;
  await ensureSchema();
  return sql`SELECT * FROM orders ORDER BY ordered_at DESC LIMIT 200`;
}
