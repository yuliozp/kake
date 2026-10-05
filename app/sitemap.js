export default function sitemap() {
  const base = "https://karlasbake.com";
  return [
    { url: base + "/", changeFrequency: "weekly", priority: 1 },
    { url: base + "/catalogo", changeFrequency: "weekly", priority: 0.9 },
    { url: base + "/pedido", changeFrequency: "monthly", priority: 0.8 },
  ];
}
