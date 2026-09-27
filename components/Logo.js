export default function Logo({ size = 56 }) {
  return (
    <a className="logo brand" href="/" aria-label="Karla's Bake">
      <img src="/logo.jpeg" alt="Karla's Bake" className="brand-img" style={{ height: size, width: "auto" }} />
    </a>
  );
}
