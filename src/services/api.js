import axios from "axios";
import { API_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🚗 Cars
export const getCars = () => api.get("/api/cars");

// 📄 Applications
export const getApplication = (id) =>
  api.get(`/api/applications/${id}`);

export const updateApplication = (id, data) =>
  api.put(`/api/applications/${id}`, data);

export const createApplication = (data) =>
  api.post("/api/applications/save", data);

// 📑 Protocols
export const createProtocol = (data) =>
  api.post("/api/protocols/create", data);

// 📄 Decisions
export const createDecision = (data) =>
  api.post("/api/decisions/create", data);

// 📄 Dogovor
export const createDogovor = (data) =>
  api.post("/api/dogovors/create", data);

// 📄 Zayavka
export const createZayavka = (data) =>
  api.post("/api/zayavki/create", data);

// 🌦 Weather
export const getWeather = (city, date) =>
  api.get("/api/weather", {
    params: { city, date },
  });

export default api;