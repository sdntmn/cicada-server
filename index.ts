// index.ts
// @ts-nocheck
import { create, router, defaults } from "json-server";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = create();
const dbPath = resolve(__dirname, "db.json");

server.use(cors());
server.use(defaults());
server.use(router(dbPath));

const PORT = parseInt(process.env.PORT || "8080", 10);
server.listen(PORT, () => {
  console.log(`✅ JSON Server running on port ${PORT}`);
});
