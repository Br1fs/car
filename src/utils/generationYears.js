/**
 * Строка периода для поколения: числа «2010 - 2015», смешанно «2010 - н.в.», только текст и т.д.
 */
export function formatGenerationYearSpan(yf, yt, fallbackYear) {
  const sf = yf === undefined || yf === null ? "" : String(yf).trim();
  const st = yt === undefined || yt === null ? "" : String(yt).trim();
  const fb = fallbackYear === undefined || fallbackYear === null ? "" : String(fallbackYear).trim();

  if (!sf && !st) return fb || "—";

  const n1 = sf === "" ? NaN : Number(String(sf).replace(",", "."));
  const n2 = st === "" ? NaN : Number(String(st).replace(",", "."));
  const bothNum = Number.isFinite(n1) && Number.isFinite(n2);
  if (bothNum && n1 !== n2) return `${sf} - ${st}`;
  if (bothNum) return sf || fb || "—";
  if (sf && st) return `${sf} - ${st}`;
  if (sf) return sf;
  return st || fb || "—";
}
