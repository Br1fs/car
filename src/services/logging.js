export const createLogEntry = ({ action, status, startTime }) => {
  return {
    action,
    status,
    startTime,
    endTime: Date.now(),
    duration: Date.now() - startTime
  };
};