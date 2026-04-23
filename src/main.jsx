import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import App from "./App";
import "./index.css";
import { buildAuthHeaders } from "./utils/authHeaders";

axios.interceptors.request.use((config) => {
  const headers = buildAuthHeaders();
  config.headers = {
    ...(config.headers || {}),
    ...headers,
  };
  return config;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
