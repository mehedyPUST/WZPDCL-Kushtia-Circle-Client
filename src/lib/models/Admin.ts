import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      default: "viewer",
    },
    assignedStation: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Admin =
  (mongoose.models.Admin as mongoose.Model<any>) ||
  mongoose.model<any>("Admin", adminSchema);

export default Admin;
