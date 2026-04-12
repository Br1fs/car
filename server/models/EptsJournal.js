import mongoose from "mongoose";

const eptsJournalSchema = new mongoose.Schema(
  {
    date: { type: String, default: "" },
    sbktsNumber: { type: String, required: true, trim: true },
    category: { type: String, default: "" },
    brand: { type: String, default: "" },
    vin: { type: String, default: "" },
    sbktsStatus: { type: String, default: "" },
    eptsStatus: { type: String, default: "" },
  },
  { timestamps: true }
);

const EptsJournal =
  mongoose.models.EptsJournal ||
  mongoose.model("EptsJournal", eptsJournalSchema);

export default EptsJournal;