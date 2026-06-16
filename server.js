import "dotenv/config";

import app from "./app.js";
import { connectDatabase } from "./api/_database.js";

const port = Number(process.env.PORT) || 8080;

try {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
} catch (error) {
  console.error("Unable to start backend:", error.message);
  process.exit(1);
}
