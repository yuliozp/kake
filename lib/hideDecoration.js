import { neon } from "@neondatabase/serverless";

// Decoración sencilla y premium ya no se eligen. Si el cliente sube una foto,
// Karla confirma el precio adicional.
export async function hideDecorationOptions() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = neon(url);
  await sql`UPDATE catalog_options SET active = false WHERE category = 'decoration'`;
}
