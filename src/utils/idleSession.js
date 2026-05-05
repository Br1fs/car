/** Неактивность: после этого интервала выполняется выход (как по кнопке «Выход»). */
export const IDLE_MS = 30 * 60 * 1000;

const STORAGE_KEY = "lastActivityAt";

export function touchActivity() {
  try {
    if (!localStorage.getItem("token")) return;
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearActivityTimestamp() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Для уже залогиненных пользователей после обновления страницы без метки — ставим текущее время. */
export function bootstrapActivityIfNeeded() {
  try {
    if (!localStorage.getItem("token")) return;
    if (!localStorage.getItem(STORAGE_KEY)) touchActivity();
  } catch {
    /* ignore */
  }
}

export function isIdleExceeded() {
  try {
    if (!localStorage.getItem("token")) return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const last = parseInt(raw, 10);
    if (Number.isNaN(last)) return false;
    return Date.now() - last > IDLE_MS;
  } catch {
    return false;
  }
}
