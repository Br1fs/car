import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const BASE_URL = `${API_URL}/api/epts-journal`;

export async function fetchEptsRows() {
  const response = await axios.get(BASE_URL);
  return Array.isArray(response.data) ? response.data : [];
}

export async function createEptsRow(payload) {
  const response = await axios.post(BASE_URL, payload);
  return response.data;
}

export async function updateEptsRow(id, payload) {
  const response = await axios.put(`${BASE_URL}/${id}`, payload);
  return response.data;
}

export async function removeEptsRow(id) {
  await axios.delete(`${BASE_URL}/${id}`);
}
