export function getUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function buildAuthHeaders() {
  const headers = {};
  const token = localStorage.getItem("token");
  const user = getUserFromStorage();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (user) {
    headers["x-user"] = JSON.stringify(user);
  }

  return headers;
}

export const getAuthHeaders = buildAuthHeaders;
