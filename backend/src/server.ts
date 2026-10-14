
import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = Number(process.env.PORT) || 8000;

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`FleetDash API running on port ${PORT}`);
    });
  } catch (error: unknown) {
    console.error("Failed to start FleetDash:", error);
    process.exitCode = 1;
  }
};

void startServer();
