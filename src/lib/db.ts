import mongoose from "mongoose";

// CRITICAL: fail fast, do not buffer commands when MongoDB is unreachable
mongoose.set("bufferCommands", false);

const MONGODB_URI = process.env.MONGODB_URI;

let cached = globalThis.__mongooseCache;
if (!cached) {
  cached = globalThis.__mongooseCache = {
    conn: null,
    promise: null,
    warnedOffline: false,
  };
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDB() {
  if (isDbConnected() && cached.conn) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    if (!cached.warnedOffline) {
      cached.warnedOffline = true;
      console.warn(
        "[AI Studio] MONGODB_URI not set — using in-memory mock store"
      );
    }
    return null;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 2000,
      })
      .then((m) => {
        cached.conn = m;
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        cached.conn = null;
        if (!cached.warnedOffline) {
          cached.warnedOffline = true;
          console.warn(
            "[AI Studio] MongoDB not connected — using in-memory mock store:",
            err.message
          );
        }
        return null;
      });
  }

  return cached.promise;
}
