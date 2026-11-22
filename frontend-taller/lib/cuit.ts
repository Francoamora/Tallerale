/** Validación del CUIT/CUIL con el dígito verificador de ARCA (módulo 11). */
export function validarCuit(valor: string): { ok: boolean; formateado: string; mensaje: string } {
  const d = valor.replace(/\D/g, "");
  if (!d) return { ok: true, formateado: "", mensaje: "" };
  if (d.length !== 11) return { ok: false, formateado: valor, mensaje: `Tiene ${d.length} números; un CUIT tiene 11.` };
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const resto = pesos.reduce((t, p, i) => t + p * Number(d[i]), 0) % 11;
  const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  const formateado = `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}`;
  if (verificador !== Number(d[10])) return { ok: false, formateado, mensaje: "El último número no coincide: revisá que esté bien escrito." };
  return { ok: true, formateado, mensaje: "" };
}
