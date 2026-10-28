import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "app",
    },
    /** Max Load page ring filter: with = all data, without = no-ring only */
    maxLoadRingMode: {
      type: String,
      enum: ["with", "without"],
      default: "with",
    },
    /**
     * Calculator UI ring toggles per feeder id.
     * Plain object e.g. { "1": true, "8": true } — Mixed for reliable save/load.
     */
    calculatorRingActive: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, strict: false }
);

export default mongoose.models.Settings ||
  mongoose.model("Settings", settingsSchema);
