export default function Logo({ size = 56 }) {
  return (
    <a className="logo brand" href="/" aria-label="Karla's Bake">
      <img src="/logo.jpg" alt="Karla's Bake" className="brand-img" style={{ height: size, width: "auto" }} onError={(e)=>{e.currentTarget.src='https://raw.githubusercontent.com/yuliozp/kake/main/public/logo.jpg';}} />
    </a>
  );
}
