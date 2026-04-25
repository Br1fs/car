import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

export function useCars(form) {
  const [cars, setCars] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/api/cars`)
      .then(res => setCars(res.data))
      .catch(console.error);
  }, []);

  const filtered = {
    types: [...new Set(cars.map(c => c.type))],
    brands: [...new Set(cars.filter(c => c.type === form.type).map(c => c.brand))],
    models: [...new Set(cars.filter(c => c.brand === form.brand).map(c => c.model))],
    years: [...new Set(cars.filter(c => c.model === form.model).map(c => c.year))],
    volumes: [...new Set(cars.filter(c => c.year === Number(form.year)).map(c => c.volume))]
  };

  return { data: cars, filtered };
}