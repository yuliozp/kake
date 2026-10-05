// Catálogo de Karla's Bake (octubre 2026), tomado de su catálogo en PDF: una foto por pastel.
// Se carga una sola vez en la base de datos; después se administra desde el panel (pestaña Pasteles).
// kind: cake = color + sabor + relleno · chocoflan = solo color · cupcakes = solo sabor · tresleches = color + relleno opcional
export const CATALOG_2026 = [
  {"name": "Pastel decoración simple y sencilla", "price": 90, "portions": "50-55 porciones", "size": "10 pulgadas", "kind": "cake", "image": "/catalogo/01-decoracion-simple-10.jpg"},
  {"name": "Chocoflan decorado chantilly", "price": 35, "portions": "15-18 porciones", "size": "8 pulgadas", "kind": "chocoflan", "image": "/catalogo/02-chocoflan-chantilly.jpg"},
  {"name": "Pastel doble altura con corona", "price": 80, "portions": "40-45 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/03-doble-altura-corona.jpg"},
  {"name": "Pastel con decoración sencilla y simple", "price": 45, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/04-decoracion-sencilla-8.jpg"},
  {"name": "Pastel decoración sencilla", "price": 30, "portions": "5-8 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/05-decoracion-sencilla-6.jpg"},
  {"name": "Pastel de dos pisos decoración de Alicia en el país de las maravillas", "price": 110, "portions": "30-35 porciones", "size": "8 y 6 pulgadas", "kind": "cake", "image": "/catalogo/06-dos-pisos-alicia.jpg"},
  {"name": "Pastel de dos pisos con decoración de revelación de género", "price": 110, "portions": "30-35 porciones", "size": "8 y 6 pulgadas", "kind": "cake", "image": "/catalogo/07-dos-pisos-revelacion-8-6.jpg"},
  {"name": "Pastel con “Felicidades…”", "price": 45, "portions": "24-28 porciones", "size": "10 pulgadas", "kind": "cake", "image": "/catalogo/08-felicidades.jpg", "description": "Escribe el nombre o la frase en las notas al personalizar."},
  {"name": "Pastel con decoración de Flork", "price": 45, "portions": "24-28 porciones", "size": "10 pulgadas", "kind": "cake", "image": "/catalogo/09-flork.jpg"},
  {"name": "Pastel con decoración de mariposas", "price": 45, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/10-mariposas.jpg"},
  {"name": "Pastel con decoración de perlas", "price": 45, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/11-perlas.jpg"},
  {"name": "Pastel con decoración de lazos y corazones", "price": 45, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/12-lazos-corazones.jpg"},
  {"name": "Pastel con decoración de margaritas", "price": 55, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/13-margaritas.jpg"},
  {"name": "Pastel de dos pisos con decoración de revelación de género", "price": 130, "portions": "45-50 porciones", "size": "10 y 8 pulgadas", "kind": "cake", "image": "/catalogo/14-dos-pisos-revelacion-10-8.jpg"},
  {"name": "Pastel con difuminado", "price": 45, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/15-difuminado.jpg"},
  {"name": "Pastel forma de corazón vintage con lazos y letrero encima", "price": 45, "portions": "8-10 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/16-corazon-vintage-lazos.jpg"},
  {"name": "Pastel con decoración con bolas", "price": 40, "portions": "8-10 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/17-bolas.jpg"},
  {"name": "Pastel con decoración tropicoqueta", "price": 50, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/18-tropicoqueta.jpg"},
  {"name": "Pastel con decoración de carro", "price": 65, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/19-carro.jpg"},
  {"name": "Pastel con gemas", "price": 50, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/20-gemas.jpg"},
  {"name": "Docena de cupcakes unicornio", "price": 15, "portions": "", "size": "", "kind": "cupcakes", "image": "/catalogo/21-cupcakes-unicornio.jpg", "description": "Caja de 12 cupcakes."},
  {"name": "Tres leches en bandeja decoración sencilla con o sin relleno", "price": 50, "portions": "", "size": "14 x 10 pulgadas", "kind": "tresleches", "image": "/catalogo/22-tres-leches-bandeja.jpg"},
  {"name": "Docena de cupcakes con imagen comestible", "price": 25, "portions": "", "size": "", "kind": "cupcakes", "image": "/catalogo/23-cupcakes-imagen-comestible.jpg", "description": "Caja de 12 cupcakes. Sube tu imagen al personalizar."},
  {"name": "Pastel con decoración de Paw Patrol", "price": 50, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/24-paw-patrol.jpg"},
  {"name": "Pastel con decoración floral elegante", "price": 45, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/25-floral-elegante.jpg"},
  {"name": "Pastel con decoración elegante", "price": 35, "portions": "8-10 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/26-elegante.jpg"},
  {"name": "Pastel con decoración de barbería", "price": 40, "portions": "8-10 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/27-barberia.jpg"},
  {"name": "Pastel doble altura con decoración revelación de género", "price": 65, "portions": "18-20 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/28-doble-altura-revelacion.jpg"},
  {"name": "Pastel vintage en forma de corazón", "price": 65, "portions": "28-30 porciones", "size": "10 pulgadas", "kind": "cake", "image": "/catalogo/29-vintage-corazon.jpg"},
  {"name": "Pastel de dos pisos con decoración con gemas", "price": 100, "portions": "30-35 porciones", "size": "8 y 6 pulgadas", "kind": "cake", "image": "/catalogo/30-dos-pisos-gemas.jpg"},
  {"name": "Pastel con decoración con fresas", "price": 50, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/31-fresas.jpg"},
  {"name": "Pastel con decoración de Bluey", "price": 50, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/32-bluey.jpg"},
  {"name": "Pastel vintage con corona", "price": 55, "portions": "20-24 porciones", "size": "8 pulgadas", "kind": "cake", "image": "/catalogo/33-vintage-corona.jpg"},
  {"name": "Pastel con imagen comestible", "price": 40, "portions": "5-8 porciones", "size": "6 pulgadas", "kind": "cake", "image": "/catalogo/34-imagen-comestible.jpg", "description": "Sube tu imagen al personalizar."},
];

// Personalizaciones sin costo de cada producto, según su tipo.
export const CATALOG_COLORS = ["Rosa", "Azul", "Blanco", "Lila", "Amarillo", "Verde", "Rojo", "Naranja"];
export function catalogOptions(kind, flavors, fillings) {
  const color = { name: "Color", choices: CATALOG_COLORS };
  const flavor = flavors.length ? [{ name: "Sabor del pastel", choices: flavors }] : [];
  const filling = fillings.length ? [{ name: "Sabor del relleno", choices: fillings }] : [];
  if (kind === "chocoflan") return [color];
  if (kind === "cupcakes") return flavor;
  if (kind === "tresleches") return [color, ...(fillings.length ? [{ name: "Relleno", choices: ["Sin relleno", ...fillings] }] : [])];
  return [color, ...flavor, ...filling];
}
