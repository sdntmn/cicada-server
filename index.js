// index.js
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ SUPABASE_URL и SUPABASE_ANON_KEY обязательны!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Эндпоинт: получить все аккаунты
app.get("/accounts", async (req, res) => {
  const { data, error } = await supabase.from("accounts").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Эндпоинт: получить аккаунт по ID
app.get("/accounts/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Account not found" });
    }
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// Аналогично для users, houses и т.д.
app.get("/users", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Эндпоинт: получить пользователя по ID
app.get("/users/:id", async (req, res) => {
  const { id } = req.params;

  // Валидация ID (опционально, но рекомендуется)
  if (!id || id.trim() === "") {
    return res.status(400).json({ error: "User ID is required" });
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single(); // .single() ожидает ровно одну запись

  if (error) {
    // Ошибка "не найдено" в Supabase имеет код 'PGRST116'
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "User not found" });
    }
    // Любая другая ошибка
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.get("/houses", async (req, res) => {
  const { data, error } = await supabase.from("houses").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Эндпоинт логина (если оставляете)
app.post("/login", async (req, res) => {
  const { user_name, password } = req.body;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_name", user_name)
    .eq("password", password)
    .single();

  if (error || !data) {
    return res.status(403).json({ message: "User not found" });
  }
  res.json(data);
});

// Запуск сервера
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
