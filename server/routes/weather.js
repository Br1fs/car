import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.json({
        temp: "",
        humidity: "",
        pressure: "",
        weather: ""
      });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;

    const response = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          q: city,
          appid: apiKey,
          units: "metric",
          lang: "ru"
        }
      }
    );

    const data = response.data;

    // конвертация давления в мм рт. ст.
    const pressureMm = Math.round(data.main.pressure * 0.750062);

    res.json({
      temp: String(Math.round(data.main.temp)),
      humidity: String(data.main.humidity),
      pressure: String(pressureMm),
      weather: data.weather?.[0]?.description || ""
    });

  } catch (error) {
    console.error("Weather error:", error.message);

    res.json({
      temp: "",
      humidity: "",
      pressure: "",
      weather: ""
    });
  }
});

export default router;