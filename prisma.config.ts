import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env file for Prisma CLI commands
config({ path: path.join(__dirname, ".env") });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    // Direct connection (non-pooled) used by Prisma CLI for
    // migrations, db push, and introspection
    url: process.env.DIRECT_URL!,
  },
});
