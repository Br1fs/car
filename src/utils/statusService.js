// utils/statusService.js

export const STATUSES = [
  "На одобрении",
  "Одобрено",
  "Прозвонен",
  "Фото готов",
  "В работе",
  "Выпуск готов",
];

export function normalizeStatus(status) {
  if (!status) return "На одобрении";
  return STATUSES.includes(status) ? status : "На одобрении";
}