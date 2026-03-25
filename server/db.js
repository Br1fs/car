import { MongoClient } from "mongodb";

const uri = "mongodb+srv://admin:admin@cluster0.1olglyq.mongodb.net/applications_portal";
const client = new MongoClient(uri);

let db;

export async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("applications_portal");
    console.log("MongoDB connected");
  }
  return db;
}

export function getDB() {
  if (!db) {
    throw new Error("DB not connected");
  }
  return db;
}
