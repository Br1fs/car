import axios from "axios";
import { API_URL } from "../config";

export async function addLog(applicationId, log) {
  return axios.post(`${API_URL}/api/logs`, {
    applicationId,
    log,
  });
}