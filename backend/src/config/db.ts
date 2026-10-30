import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  await mongoose.connect(mongoUri, {
    maxPoolSize: 30,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connected successfully");
  console.log("MongoDB connection pool configured");
};

export default connectDB;
