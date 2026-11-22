import { redirect } from "next/navigation";

/** /pagos no tiene pantalla propia: los cobros se ven en la Caja. */
export default function Pagos() {
  redirect("/caja");
}
