"use client";
import { IMAGES } from "@/lib/defaults";
import Logo from "@/components/Logo";

const MAP = "https://www.google.com/maps/search/?api=1&query=3920+Highway+365+Apt+247+Building+17+Port+Arthur+Texas+77642";
const PHONE = "+14093325768";
const WA = "https://wa.me/14093325768";
const SMS = "sms:+14093325768";
const CALL = "tel:+14093325768";

export default function Home() {
  return (
    <main className="wrap promo">
      <section id="inicio" className="hero">
        <div>
          <Logo size={120} />
          <p className="note">Pasteles artesanales en Port Arthur, Texas</p>
          <h1>Karla's Bake</h1>
          <p className="lead">Kakes hechos a mano para el dia que importa. Elige sabor, tamano y diseno. Nosotros horneamos la emocion.</p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <a className="btn" href="/pedido">Personaliza tu kake</a>
            <a className="btn ghost" href="#contacto">Contactanos</a>
          </div>
        </div>
        <img src={IMAGES.hero} alt="Kake Karla's Bake" />
      </section>

      <section id="novedades" className="card" style={{ marginTop: 24 }}>
        <h2>Novedades</h2>
        <p>Esta temporada: drips de chocolate, naked cakes con berries y frases personalizadas. Reserva con 48 horas. Cupos limitados los fines de semana.</p>
        <p className="note">Siguenos en Instagram y TikTok @karlasbake para ver lo que sale del horno hoy.</p>
      </section>

      <section id="talento" className="card" style={{ marginTop: 16 }}>
        <h2>Nuestro talento</h2>
        <p>Detras de cada kake hay manos que miden, prueban y decoran con calma. En Karla's Bake no copiamos un catalogo: interpretamos tu idea y la convertimos en porciones que se recuerdan.</p>
        <p className="note">Chocolate, vainilla, coco, fresa. Rellenos de dulce de leche y ganache. El detalle lo pone tu foto de referencia.</p>
      </section>

      <section id="contacto" className="card" style={{ marginTop: 16 }}>
        <h2>Contactenos</h2>
        <p>
          <a href={MAP} target="_blank" rel="noreferrer">3920 Highway 365 Apt 247 Building 17, Port Arthur, Texas, 77642</a>
        </p>
        <p>Cell: <a href={CALL}>+1 (409) 332-5768</a></p>
        <div className="row">
          <a className="btn" href={CALL}>Llamar</a>
          <a className="btn ghost" href={SMS}>SMS</a>
          <a className="btn ghost" href={WA} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
        <p>Email: <a href="mailto:karlagabyzorrilla@gmail.com">karlagabyzorrilla@gmail.com</a></p>
        <p>
          <a href="https://www.facebook.com/karla.sbake" target="_blank" rel="noreferrer">Facebook</a>
          {" · "}
          <a href="https://www.instagram.com/karlasbake/" target="_blank" rel="noreferrer">Instagram</a>
          {" · "}
          <a href="https://www.tiktok.com/@karlasbake" target="_blank" rel="noreferrer">TikTok</a>
        </p>
      </section>
    </main>
  );
}
