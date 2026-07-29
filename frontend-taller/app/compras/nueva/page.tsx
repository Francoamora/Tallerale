import { redirect } from "next/navigation";

export default function NuevaCompraLegacy() {
  redirect("/gastos?nuevo=1");
}
