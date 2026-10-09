import CustomerOrder from "./CustomerOrder";

export const metadata = { title: "Mi pedido · My order", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { t, pagado, cancelado, nuevo, pagar } = await searchParams;
  return (
    <CustomerOrder
      id={id}
      token={typeof t === "string" ? t : ""}
      paidSession={typeof pagado === "string" ? pagado : ""}
      cancelled={cancelado === "1"}
      fresh={nuevo === "1"}
      autoPay={pagar === "1"}
    />
  );
}
