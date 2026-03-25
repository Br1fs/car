import mongoose from "mongoose";

const CarSchema = new mongoose.Schema({
    Тип: String,
  Марка: String,
  Наименование: String,
  VIN: String,
  Год: Number,
  Объем: Number,
  Категория: String,
  category: String,
  brand: String,
  commercialName: String,
  year: Number,
  engineVolume: String,
  protocolNumber: {
    type: String,
    default: ""
  },

  manufacturer: {
    legalAddress: String,
    factoryAddress: String
  },

  assemblyPlant: {
    legalAddress: String,
    factoryAddress: String
  },

  bodyType: String,
  doors: Number,
  seatsFront: Number,
  seatsRear: Number,
  drive: String,
  engine: {
    type: String,
    cylinders: String,
    power: String,
    fuel: String
  },
  transmission: String,
  suspension: {
    front: String,
    rear: String
  },
  brakes: {
    working: String,
    parking: String
  },
  tires: String
});

export default mongoose.model("Car", CarSchema);
