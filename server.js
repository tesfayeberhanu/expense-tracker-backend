import "dotenv/config";

import app from "./app.js";
import { connectDatabase } from "./api/_database.js";

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";

try {
  await connectDatabase();
  app.listen(port, host, () => {
    console.log(`Backend listening on ${host}:${port}`);
  });
} catch (error) {
  console.error("Unable to start backend:", error.message);
  process.exit(1);
}
