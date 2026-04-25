import axios from "axios";
import { API_URL } from "../config";

export function useProtocol(form, formId) {

  const createProtocol = async (data) => {
    const res = await axios.post(`${API_URL}/api/protocols/create`, {
      ...data,
      applicationId: formId || null
    });

    window.open(
      `${API_URL}/api/protocols/${res.data._id}/pdf-template`,
      "_blank"
    );
  };

  return { createProtocol };
}