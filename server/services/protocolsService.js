import { ObjectId } from "mongodb";
import { getDB } from "../db.js";

export function isValidObjectId(id) {
  return ObjectId.isValid(id);
}

export async function listProtocols() {
  const db = getDB();
  return db
    .collection("protocols")
    .find(
      {},
      {
        projection: {
          protocolNumber: 1,
          createdAt: 1,
          fio: 1,
          vin: 1,
          brand: 1,
          model: 1,
          typ: 1,
          category: 1,
          fuelType: 1,
        },
      }
    )
    .sort({ createdAt: -1 })
    .toArray();
}

export async function createProtocol(data) {
  const db = getDB();
  const result = await db.collection("protocols").insertOne({
    ...data,
    createdAt: new Date(),
  });

  return result.insertedId.toString();
}

export async function getProtocolById(id) {
  const db = getDB();
  return db.collection("protocols").findOne({ _id: new ObjectId(id) });
}

export async function deleteProtocolById(id) {
  const db = getDB();
  return db.collection("protocols").deleteOne({ _id: new ObjectId(id) });
}

export function toValidObjectIds(ids) {
  return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
}

export async function bulkDeleteProtocolsByIds(ids) {
  const db = getDB();
  return db.collection("protocols").deleteMany({
    _id: { $in: ids },
  });
}
