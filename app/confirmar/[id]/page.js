import KarlaConfirm from "./KarlaConfirm";

export const metadata = { title: "Confirmar pedido", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { t } = await searchParams;
  return <KarlaConfirm id={id} token={typeof t === "string" ? t : ""} />;
}
