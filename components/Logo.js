export default function Logo({ size = 64 }) {
  return (
    <a className="logo brand" href="/" aria-label="Karla's Bake">
      <img
        src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><circle cx='100' cy='100' r='98' fill='%23fff'/><g fill='%23f4b7c8'><ellipse cx='42' cy='48' rx='7' ry='11' transform='rotate(-30 42 48)'/><ellipse cx='158' cy='48' rx='7' ry='11' transform='rotate(30 158 48)'/><ellipse cx='28' cy='88' rx='7' ry='11' transform='rotate(-70 28 88)'/><ellipse cx='172' cy='88' rx='7' ry='11' transform='rotate(70 172 88)'/><ellipse cx='38' cy='140' rx='7' ry='11' transform='rotate(-120 38 140)'/><ellipse cx='162' cy='140' rx='7' ry='11' transform='rotate(120 162 140)'/><ellipse cx='70' cy='174' rx='7' ry='11' transform='rotate(-160 70 174)'/><ellipse cx='130' cy='174' rx='7' ry='11' transform='rotate(160 130 174)'/><ellipse cx='70' cy='26' rx='7' ry='11' transform='rotate(-10 70 26)'/><ellipse cx='130' cy='26' rx='7' ry='11' transform='rotate(10 130 26)'/></g><rect x='78' y='72' width='44' height='28' fill='%23f7c5d2' stroke='%23222' stroke-width='2'/><rect x='70' y='100' width='60' height='28' fill='%23f7c5d2' stroke='%23222' stroke-width='2'/><path d='M100 54c0 10-6 16-6 20' fill='none' stroke='%23222' stroke-width='2'/><path d='M94 50c4 2 8 0 10-4' fill='%23f7c5d2' stroke='%23222'/><path d='M70 128c10 16 50 16 60 0' fill='none' stroke='%23222' stroke-width='2'/><path d='M88 128v18M112 128v14' fill='none' stroke='%23222' stroke-width='2'/><text x='100' y='122' text-anchor='middle' font-family='Georgia, serif' font-size='20' font-style='italic' fill='%23111'>Karla%27s Bake</text></svg>"
        alt="Karla's Bake"
        className="brand-img"
        style={{ height: size, width: "auto" }}
      />
    </a>
  );
}
