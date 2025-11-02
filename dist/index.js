"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// index.ts
// @ts-nocheck
const json_server_1 = require("json-server");
const cors_1 = __importDefault(require("cors"));
const url_1 = require("url");
const path_1 = require("path");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, path_1.dirname)(__filename);
const server = (0, json_server_1.create)();
const dbPath = (0, path_1.resolve)(__dirname, "db.json");
server.use((0, cors_1.default)());
server.use((0, json_server_1.defaults)());
server.use((0, json_server_1.router)(dbPath));
const PORT = parseInt(process.env.PORT || "8080", 10);
server.listen(PORT, () => {
    console.log(`✅ JSON Server running on port ${PORT}`);
});
