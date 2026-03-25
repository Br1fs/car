import { MongoClient } from "mongodb";

// Замени ТВОЙ_ПАРОЛЬ на свой пароль в Atlas
const uri = "mongodb+srv://admin:admin@cluster0.1olglyq.mongodb.net/applications_portal?retryWrites=true&w=majority";

async function migrate() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("applications_portal");

    const oldCars = db.collection("cars");
    const newCars = db.collection("cars_temp"); // временная коллекция, чтобы не трогать оригинал

    const cursor = oldCars.find();
    for await (const doc of cursor) {
       const years = Array.isArray(doc.Года) ? doc.Года : (doc.Года ? [doc.Года] : []);
  const volumes = Array.isArray(doc.Объемы) ? doc.Объемы : (doc.Объемы ? [doc.Объемы] : []);

      for (const year of years) {
        for (const volume of volumes) {
          await newCars.insertOne({
            type: doc.Тип,
            brand: doc.Марка,
            model: doc.Наименование,
            year,
            volume,
            category: doc.Категория,
            vin: doc.VIN || "",
            seats: doc.seats || "",
            cab: doc.cab || "",
            frame: doc.frame || "",
            manufacturer: doc.Изготовитель || "",
            manufacturerLegalAddress: doc.ИзготовительЮрАдрес || "",
            manufacturerActualAddress: doc.ИзготовительФакАдрес || "",
            factory: doc.СборочныйЗавод || "",
            factoryAddress: doc.СборочныйЗаводАдрес || "",
            engineType: doc.Двигатель || "",
            cylinders: doc.Цилиндры || "",
            engineVolume: doc.РабОбъем || "",
            power: doc.Мощность || "",
            fuel: doc.Топливо || "",
            curbMass: doc.МассаТС || "",
            maxMass: doc.ТехДопМаксМасса || "",
            brakesType: doc.ТормозаТип || "",
            tires: doc.Шины || "",
            additionalEquipment: doc.ДопОборудование || "",
            transmission: doc.Коробка || ""
          });
        }
      }
    }

    console.log("Миграция завершена! Все документы с русскими ключами преобразованы в латиницу.");
    console.log("Проверь коллекцию 'cars_temp'. Если всё верно, можно удалить старую 'cars' и переименовать 'cars_temp' в 'cars'.");
  } catch (err) {
    console.error("Ошибка при миграции:", err);
  } finally {
    await client.close();
  }
}

migrate();
