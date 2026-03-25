import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

const cars = [
  {
    Тип: "Седан",
    Марка: "Toyota",
    Наименование: "Camry",
    VIN: "1234567890ABCDE",
    Год: 2020,
    Объем: 2500,
    Категория: "M1"
  },
  {
    Тип: "Внедорожник",
    Марка: "Honda",
    Наименование: "CR-V",
    VIN: "ABCDE1234567890",
    Год: 2021,
    Объем: 2000,
    Категория: "M1"
  }
];

async function seed() {
  await Car.deleteMany({});
  await Car.insertMany(cars);
  console.log("Cars seeded!");
  mongoose.disconnect();
}

seed();
