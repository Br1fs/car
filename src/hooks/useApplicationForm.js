import { useState } from "react";
import { createLogEntry } from "../services/logging";

export function useApplicationForm() {
  const [form, setForm] = useState({});

  const startTimer = (t) => {
    window._startTime = t;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm(prev => {
      const next = { ...prev, [name]: value };

      // FIX: category logic
      if (name === "templateCategory") {
        next.fuelType = "";
        next.n3Type = "";
      }

      return next;
    });
  };

  const getLog = (action) =>
    createLogEntry({
      action,
      status: form.status1 || "На одобрении",
      startTime: window._startTime || Date.now(),
    });

  return {
    form,
    setForm,
    handleChange,
    startTimer,
    getLog,
  };
}