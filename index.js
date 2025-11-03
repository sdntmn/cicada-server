const jsonServer = require("json-server");
const cors = require("cors");
const path = require("path");

const server = jsonServer.create();
const router = jsonServer.router(path.resolve(__dirname, "db.json"));

// Включаем CORS для любого origin
server.use(cors());

// Подключаем стандартные middleware (статика, bodyParser и т.д.)
server.use(jsonServer.defaults());

// Подключаем маршруты из db.json
server.use(router);

// Порт из переменной окружения (Render задаёт его автоматически)
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`✅ JSON Server running on port ${PORT}`);
});
