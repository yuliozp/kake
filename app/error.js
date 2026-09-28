"use client";
import { useEffect } from "react";

// Si algo falla en una página, el cliente ve esto en lugar de una pantalla en blanco.
export default function Error({ error, reset }) {
  useEffect(() => { console.error("[page-error]", error?.digest || error); }, [error]);
  return (
    <main id="contenido" className="wrap narrow">
      <div className="card error-page">
        <h1 className="h2">Algo salió mal · Something went wrong</h1>
        <p>Intenta de nuevo. Si sigue pasando, escríbenos por WhatsApp al +1 (409) 332-5768.</p>
        <div className="row center">
          <button className="btn" onClick={() => reset()}>Intentar de nuevo</button>
          <a className="btn ghost" href="/">Ir al inicio</a>
        </div>
      </div>
    </main>
  );
}
