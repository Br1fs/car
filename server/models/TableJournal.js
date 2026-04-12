import mongoose from "mongoose";

const tableJournalSchema = new mongoose.Schema(
  {
    applicationId: { type: String, default: "", index: true },
    numeration: { type: Number, default: 0 },
    number: { type: String, default: "" },
    fio: { type: String, default: "" },
    type: { type: String, default: "" },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    color: { type: String, default: "" },
    vinCode: { type: String, default: "" },
    broker: { type: String, default: "" },
    applicationStatus: { type: String, default: "" },
    submitDate: { type: String, default: "" },
    applicationNumber: { type: String, default: "" },
    specialist: { type: String, default: "" },
    sbktsNumber: { type: String, default: "" },
    comment: { type: String, default: "" },
    sbktsEptsStatus: { type: String, default: "" },
    eptsStatus: { type: String, default: "" },
  },
  { timestamps: true }
);

const TableJournal =
  mongoose.models.TableJournal ||
  mongoose.model("TableJournal", tableJournalSchema);

export default TableJournal;