import { MongoClient } from "mongodb";

const uri = "mongodb+srv://admin:admin@cluster0.1olglyq.mongodb.net/applications_portal?retryWrites=true&w=majority";

const client = new MongoClient(uri);

async function test() {
  try {
    await client.connect();
    console.log("✅ Подключение к MongoDB успешно!");
    const db = client.db("applications_portal");
    const collections = await db.listCollections().toArray();
    console.log("Коллекции в базе:", collections.map(c => c.name));
  } catch (err) {
    console.error("❌ Ошибка подключения:", err);
  } finally {
    await client.close();
  }
}

test();
