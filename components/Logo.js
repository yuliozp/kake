export default function Logo({ size = 42 }) {
  return (
    <a className="logo brand" href="/" aria-label="Karla's Bake">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#ff5c8a" />
        <circle cx="32" cy="32" r="24" fill="#fff6f0" />
        <path d="M18 40c4-12 10-18 14-18s10 6 14 18" fill="none" stroke="#4a2c2a" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 28c2-6 8-8 8-8s6 2 8 8" fill="#e8b86d" />
        <circle cx="32" cy="22" r="3" fill="#e23a6d" />
      </svg>
      <span className="brand-text">
        <b>Karla&apos;s Bake</b>
        <small>kake</small>
      </span>
    </a>
  );
}
