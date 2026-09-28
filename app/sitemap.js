export default function sitemap() {
  const base = "https://kake-five.vercel.app";
  return [
    { url: base + "/", changeFrequency: "weekly", priority: 1 },
    { url: base + "/pedido", changeFrequency: "monthly", priority: 0.8 },
  ];
}
