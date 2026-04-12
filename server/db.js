import { MongoClient } from "mongodb";
import mongoose from "mongoose";

const uri = "mongodb+srv://admin:admin@cluster0.1olglyq.mongodb.net/applications_portal";
const client = new MongoClient(uri);

let db;

export async function connectDB() {
  try {
    if (!db) {
      await client.connect();
      db = client.db("applications_portal");
      console.log("MongoClient connected");
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, {
        dbName: "applications_portal",
      });
      console.log("Mongoose connected");
    }

    return db;
  } catch (error) {
    console.error("DB connection error:", error);
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error("DB not connected");
  }
  return db;
}
