// utils/copyApplication.js
import axios from "axios";
import { API_URL } from "../config";

export async function getApplicationForCopy(id) {
  const res = await axios.get(`${API_URL}/api/applications/${id}`);
  const data = res.data;

  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;

 return {
  ...data,
  fio: (data.fio || "") + " (копия)",
};
}