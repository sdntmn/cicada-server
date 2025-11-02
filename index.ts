import { create, router, defaults } from "json-server";
import type { NextFunction, Request, Response } from "express";
import path from "path";

const server = create();
const DB_PATH = path.resolve(__dirname, "db.json");
// const routerDb = jsonServer.router(DB_PATH);

// Разрешить CORS (опционально, но полезно при работе с Vite)
server.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Подключаем стандартные middleware (статика, bodyParser и т.д.)
server.use(defaults());

// Роутер
server.use(router(DB_PATH));

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`JSON Server is running on http://localhost:${PORT}`);
});
