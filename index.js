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

app.post("/search-accounts", async (req, res) => {
  const {
    houseIds,
    minDebt,
    minTerm,
    filterMode = "all",
    page = 0,
    pageSize = 20,
  } = req.body;

  // Валидация filterMode
  if (filterMode !== "all" && filterMode !== "any") {
    return res.status(400).json({ error: "filterMode must be 'all' or 'any'" });
  }

  // Валидация pageSize
  const size = Math.min(Math.max(pageSize, 1), 100);
  const from = page * size;
  const to = from + size - 1;

  // Условия фильтрации
  const hasHouseIds = Array.isArray(houseIds) && houseIds.length > 0;
  const hasDebt = typeof minDebt === "number" && minDebt > 0;
  const hasTerm =
    typeof minTerm === "number" && minTerm > 0 && Number.isInteger(minTerm);

  try {
    if (filterMode === "any") {
      // Режим "ИЛИ" — используем RPC
      const { data, error } = await supabase.rpc("search_accounts_or", {
        p_house_ids: hasHouseIds ? houseIds : null,
        p_min_debt: hasDebt ? minDebt : null,
        p_min_term: hasTerm ? minTerm : null,
        p_limit: size,
        p_offset: from,
      });

      if (error) {
        console.error("RPC error:", error);
        return res.status(500).json({ error: error.message });
      }

      // RPC должен возвращать { data, total }
      const total = data?.[0]?.total_count ?? data.length; // зависит от реализации RPC
      const result = Array.isArray(data) ? data : [];

      return res.json({
        data: result,
        total,
        page,
        pageSize: size,
      });
    }

    // Режим "И" — стандартный REST запрос
    let query = supabase.from("accounts").select("*", { count: "exact" });

    if (hasHouseIds) {
      query = query.in("house_id", houseIds);
    }
    if (hasDebt) {
      query = query.gte("debt", minDebt);
    }
    if (hasTerm) {
      query = query.gte("debt_term_months", minTerm);
    }

    // Пагинация
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      data,
      total: count,
      page,
      pageSize: size,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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
