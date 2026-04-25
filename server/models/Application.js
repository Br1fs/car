const mongoose = require("mongoose");

const StatusHistorySchema = new mongoose.Schema({
  from: String,
  to: String,
  changedAt: Date,
  changedBy: String,
  durationMinutes: Number,
});

const ApplicationSchema = new mongoose.Schema(
  {
    protocolNumber: Number,

    status: {
      current: {
        type: String,
        default: "На одобрении",
      },
      history: [StatusHistorySchema],
    },

    creationTimeSpentSeconds: Number,

    createdAt: {
      type: Date,
      default: Date.now,
    },

    // остальные поля не трогаем
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", ApplicationSchema);