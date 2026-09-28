# Karla's Bake (kake)

Sitio de pedidos de pasteles personalizados — Next.js 14 en Vercel + Postgres en Neon + correos con Resend.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Página de inicio (bilingüe ES/EN) |
| `/pedido` | Asistente de pedido paso a paso |
| `/admin` | Panel privado: pedidos, catálogo y diseños (no aparece en el menú público) |
| `/api/catalog` | Catálogo público (solo opciones visibles) |
| `/api/orders` | `POST` crea un pedido · `GET` lista pedidos (requiere clave admin) |
| `/api/admin` | Gestión del catálogo (requiere clave admin) |

## Variables de entorno (Vercel)

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a Neon (proyecto `kake`). Sin ella el sitio usa memoria temporal. |
| `ADMIN_KEY` | Sí | Clave del panel `/admin`. En producción no hay clave por defecto. |
| `RESEND_API_KEY` | Sí | Envío del aviso de pedido nuevo. Guárdala como **Sensitive**. |
| `RESEND_FROM` | Recomendada | Remitente, p. ej. `Karla's Bake <pedidos@tudominio.com>` (dominio verificado en Resend). |
| `ORDER_NOTIFY_EMAIL` | Recomendada | A quién llega el aviso de cada pedido. |
| `RESEND_OWNER_EMAIL` | Opcional | Copia de respaldo si el envío principal falla. |

> Mientras `RESEND_FROM` use `onboarding@resend.dev`, Resend solo entrega al correo dueño de la cuenta.
> Para que los avisos lleguen a otra dirección hay que verificar un dominio en Resend.

## Seguridad

- El total del pedido se recalcula en el servidor con los precios del catálogo.
- La lista de pedidos (datos de clientes) solo se entrega con la clave admin.
- Las fotos se comprimen en el navegador antes de enviarse (máx. ~1 MB).

## Desarrollo local

```bash
npm install
npm run dev   # sin ADMIN_KEY la clave local es "kake"
```
