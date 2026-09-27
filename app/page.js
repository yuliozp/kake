import { IMAGES } from "@/lib/defaults";

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <p className="note">Pastelería personalizada · pedidos en línea</p>
          <h1>Tu kake, exactamente como lo soñaste.</h1>
          <p className="lead">
            Elige tamaño, sabor, relleno y diseño. Cada opción suma al precio al instante.
            Entrega o recogida, con fecha del día siguiente por defecto.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <a className="btn" href="/pedido">Personalizar mi pedido</a>
            <a className="btn ghost" href="https://www.instagram.com/p/DdxZZgTDp9a/" target="_blank">Ver inspiración en Instagram</a>
          </div>
        </div>
        <img src={IMAGES.hero} alt="Pastel kake" />
      </section>
      <section className="grid">
        {["Tamaño y porciones", "Sabores y rellenos", "Diseño a tu gusto", "Envío o recogida"].map((t) => (
          <div className="card" key={t}><strong>{t}</strong><p className="note">Configúralo paso a paso, con vista previa y precio en vivo.</p></div>
        ))}
      </section>
    </main>
  );
}
