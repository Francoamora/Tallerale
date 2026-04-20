const currencyFormatters = {
  compact: new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }),
  detailed: new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

const numberFormatter = new Intl.NumberFormat("es-AR");
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
});

export function formatCurrency(value: number | string | null | undefined, mode: "compact" | "detailed" = "compact") {
  // Django DRF serializa Decimal como string ("15000.00") — coercionamos siempre
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return currencyFormatters[mode].format(Number.isFinite(num) ? num : 0);
}

export function formatNumber(value: number | string | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return numberFormatter.format(Number.isFinite(num) ? num : 0);
}

export function formatDateTime(value: string | Date) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: string | Date) {
  return dateFormatter.format(new Date(value));
}
