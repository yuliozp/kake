# Karla's Bake (kake)

Sitio de pedidos de pasteles personalizados — Next.js 16 en Vercel + Postgres en Neon + correos con Resend.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Página de inicio (bilingüe ES/EN) |
| `/pedido` | Asistente de pedido paso a paso |
| `/admin` | Panel privado: pedidos, catálogo y diseños (no aparece en el menú público) |
| `/api/catalog` | Catálogo público (solo opciones visibles) |
| `/api/orders` | `POST` crea un pedido · `GET` lista pedidos (sesión admin) |
| `/api/orders/:id` | `PATCH` estado y cobro del pedido (sesión admin) |
| `/api/orders/:id/image` | Foto de referencia o evidencia de pago (sesión admin) |
| `/api/admin` | Gestión del catálogo (sesión admin) |
| `/api/admin/session` | Entrar / salir del panel |

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

## Pedidos: estados y cobro

Estados: Nuevo → En preparación → Listo → Entregado (o Cancelado), elegidos desde una lista en cada pedido.
Cobro por pedido: precio final, monto cobrado, fecha, forma de pago, nota y foto de evidencia.
El saldo se calcula solo (precio final − cobrado) y el panel muestra lo pendiente por cobrar.

## Seguridad

- Panel admin con sesión en cookie HttpOnly firmada (12 h); la clave nunca se guarda en el navegador.
  Cambiar `ADMIN_KEY` en Vercel cierra todas las sesiones.
- Máximo 8 intentos de clave cada 15 min y 10 pedidos por hora por conexión (contados en la base de datos).
- Toda petición que cambia datos debe venir del propio sitio (protección CSRF).
- El total del pedido se recalcula en el servidor; las fotos solo se aceptan como JPEG/PNG/WebP.
- Campo trampa anti-bots y protección contra pedidos duplicados por doble envío.
- Cabeceras de seguridad: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy.
- Los datos de clientes, fotos y evidencias de pago solo se entregan con sesión admin.

## Desarrollo local

```bash
npm install
npm run dev   # sin ADMIN_KEY la clave local es "kake"
```
