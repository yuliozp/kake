export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main id="contenido" className="wrap narrow">
      <div className="card error-page">
        <h1 className="h2">No encontramos esta página</h1>
        <p>Page not found. Puede que el enlace esté mal escrito.</p>
        <div className="row center">
          <a className="btn" href="/">Ir al inicio</a>
          <a className="btn ghost" href="/pedido">Hacer un pedido</a>
        </div>
      </div>
    </main>
  );
}
