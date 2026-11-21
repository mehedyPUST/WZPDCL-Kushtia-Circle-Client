import mongoose from "mongoose";

const overtimeSheetSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2100,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    employeeName: {
      type: String,
      default: "",
      trim: true,
    },
    designation: {
      type: String,
      default: "SBA-A",
      trim: true,
    },
    /** 0 = Sunday … 6 = Saturday */
    weeklyHoliday: {
      type: Number,
      default: 0,
      min: 0,
      max: 6,
    },
    /** YYYY-MM-DD dates excluded from overtime (casual leave) */
    clLeaveDates: {
      type: [String],
      default: [],
    },
    /** Extra duty dates that are not the normal weekly holiday */
    extraDutyDates: {
      type: [String],
      default: [],
    },
    /** A | B | C — duty shift performed on holiday */
    dutyShift: {
      type: String,
      enum: ["A", "B", "C"],
      default: "C",
    },
    purpose: {
      type: String,
      default: "সাপ্তাহিক বিরতির দিনে ডিউটি করা হয়",
      trim: true,
    },
  },
  { timestamps: true }
);

overtimeSheetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const OvertimeSheet =
  (mongoose.models.OvertimeSheet as mongoose.Model<any>) ||
  mongoose.model<any>("OvertimeSheet", overtimeSheetSchema);

export default OvertimeSheet;
