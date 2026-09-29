const mongoose = require("mongoose");

let cachedPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return true;

  if (cachedPromise) {
    try {
      return await cachedPromise;
    } catch {
      cachedPromise = null;
    }
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI is required.");
    }
    console.log("MONGODB_URI not provided; running with local persistent database fallback.");
    return false;
  }

  if (!uri.startsWith("mongodb+srv://")) {
    throw new Error("MONGODB_URI must be a MongoDB Atlas SRV connection string.");
  }

  cachedPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 4000,
    maxPoolSize: 10,
    // Do not aggressively close idle sockets. Vercel serverless instances
    // are reused and reconnecting after every short idle period makes the app slow.
    minPoolSize: 0
  }).then(() => {
    console.log("Connected to MongoDB Atlas successfully.");
    return true;
  }).catch(err => {
    cachedPromise = null;
    console.error("MongoDB Atlas connection failed:", err.message);
    throw err;
  });

  return await cachedPromise;
}

module.exports = {
  connectDB,
  get isConnected() {
    return mongoose.connection.readyState === 1;
  }
};
