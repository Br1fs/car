// utils/timeTracker.js

export function startTimer() {
  return Date.now();
}

export function calculateDuration(startTime) {
  if (!startTime) return 0;
  return Math.round((Date.now() - startTime) / 60000); // минуты
}

export function createLogEntry({
  action,
  status,
  startTime,
  user = "system",
}) {
  const safeStart = startTime ? new Date(startTime) : new Date();

  return {
    action,
    status,
    user,
    startedAt: safeStart.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMin: calculateDuration(startTime || Date.now()),
  };
}