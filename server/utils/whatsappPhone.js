/** Цифры для wa.me и WhatsApp Cloud API (без +). */
export function digitsOnlyPhone(input) {
  return String(input || "").replace(/\D/g, "");
}

/** Нормализация для РК/РФ: 10 цифр → 7…; 8XXXXXXXXXX → 7… */
export function normalizePhoneForWhatsApp(input) {
  let d = digitsOnlyPhone(input);
  if (!d) return "";
  if (d.length === 11 && d[0] === "8") d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return d;
}

export function buildWaMeUrl(phoneDigits, message = "") {
  const to = normalizePhoneForWhatsApp(phoneDigits);
  if (!to) return "";
  const base = `https://wa.me/${to}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
