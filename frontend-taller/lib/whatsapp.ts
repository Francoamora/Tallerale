/**
 * Convierte teléfonos argentinos guardados en formatos habituales
 * (3482..., 03482..., 5493482...) al formato internacional de WhatsApp.
 * Si el dato no parece utilizable, devuelve una cadena vacía para evitar
 * abrir por error un chat distinto al del cliente.
 */
export function normalizeWhatsAppPhone(phone?: string | null): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.startsWith("54") && digits.length >= 12) {
    return `549${digits.slice(2)}`;
  }
  if (digits.length === 10) return `549${digits}`;

  return digits.length >= 11 ? digits : "";
}

/**
 * Genera el enlace oficial de Click to Chat. En mobile abre directamente la
 * conversación del cliente y conserva el mensaje completo en un único
 * parámetro `text`; en escritorio continúa hacia WhatsApp Web o la app.
 */
export function buildWhatsAppUrl(text: string, phone?: string | null): string {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return "";
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}
