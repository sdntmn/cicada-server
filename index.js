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

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (accErr) {
    if (accErr.code === "PGRST116")
      return res.status(404).json({ error: "Account not found" });
    return res.status(500).json({ error: accErr.message });
  }

  // Получаем активный долг (пока только 'new', но можно расширить)
  const { data: debts } = await supabase
    .from("debt")
    .select("*")
    .eq("account_id", id)
    .eq("stage", "new");

  res.json({
    ...account,
    active_debt: debts.length > 0 ? debts[0] : null,
  });
});

app.post("/debts/candidates", async (req, res) => {
  const {
    houseIds,
    minDebt,
    minTerm,
    filterMode = "all",
    page = 0,
    pageSize = 20,
  } = req.body;

  if (filterMode !== "all" && filterMode !== "any") {
    return res.status(400).json({ error: "filterMode must be 'all' or 'any'" });
  }

  const size = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
  const from = page * size;
  const to = from + size - 1;

  try {
    // 1. Получаем все долги со статусом 'new'
    let debtQuery = supabase
      .from("debt")
      .select("account_id, amount, penalty, debt_term_months, stage", {
        count: "exact",
      })
      .eq("stage", "candidates");

    // Применяем фильтры по долгу
    if (typeof minDebt === "number" && minDebt > 0) {
      debtQuery = debtQuery.gte("amount", minDebt);
    }
    if (
      typeof minTerm === "number" &&
      minTerm > 0 &&
      Number.isInteger(minTerm)
    ) {
      debtQuery = debtQuery.gte("debt_term_months", minTerm);
    }

    const { data: debts, error: debtError } = await debtQuery;
    if (debtError) {
      console.error("Debt query error:", debtError);
      return res.status(500).json({ error: debtError.message });
    }

    const debtMap = {};
    const accountIdsFromDebt = [];
    for (const d of debts) {
      debtMap[d.account_id] = d;
      accountIdsFromDebt.push(d.account_id);
    }

    // 2. Получаем аккаунты
    let accountQuery = supabase.from("accounts").select("*");

    // Фильтр по дому — применяется к accounts
    if (Array.isArray(houseIds) && houseIds.length > 0) {
      accountQuery = accountQuery.in("house_id", houseIds);
    }

    // Если в режиме "all", то аккаунты должны быть в списке accountIdsFromDebt
    if (filterMode === "all") {
      if (accountIdsFromDebt.length === 0) {
        // Нет долгов → пустой результат
        return res.json({ data: [], total: 0, page, pageSize: size });
      }
      accountQuery = accountQuery.in("id", accountIdsFromDebt);
    }

    // Пагинация
    accountQuery = accountQuery.range(from, to);
    const { data: accounts, error: accountError, count } = await accountQuery;

    if (accountError) {
      console.error("Account query error:", accountError);
      return res.status(500).json({ error: accountError.message });
    }

    // Для режима "any": фильтруем уже на JS-уровне
    let finalAccounts = accounts;
    if (filterMode === "any") {
      finalAccounts = accounts.filter((acc) => {
        const inHouse =
          !houseIds || houseIds.length === 0 || houseIds.includes(acc.house_id);
        const debtRec = debtMap[acc.id];
        const hasDebtMatch = debtRec != null; // т.к. мы уже отфильтровали debt по minDebt/minTerm
        return inHouse || hasDebtMatch;
      });
    }

    // Обогащаем аккаунты данными о долге
    const enriched = finalAccounts.map((acc) => ({
      ...acc,
      debt: debtMap[acc.id]?.amount || 0,
      penalty: debtMap[acc.id]?.penalty || 0,
      debt_term_months: debtMap[acc.id]?.debt_term_months || null,
      debt_stage: debtMap[acc.id]?.stage || null,
    }));

    // Пагинация уже применена, но в режиме "any" количество может уменьшиться
    const total = filterMode === "all" ? count : enriched.length;

    // rowIndex — глобальный номер в выдаче (только для отображения)
    const dataWithIndex = enriched.map((row, i) => ({
      ...row,
      rowIndex: from + i + 1,
    }));

    return res.json({
      data: dataWithIndex,
      total,
      page,
      pageSize: size,
    });
  } catch (err) {
    console.error("Unexpected error in /search-accounts:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /debts/batch-to-new
app.post("/debts/batch-to-new", async (req, res) => {
  const { accountIds } = req.body;

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return res
      .status(400)
      .json({ error: "accountIds must be a non-empty array" });
  }

  try {
    const { error } = await supabase
      .from("debt")
      .update({ stage: "new", updated_at: new Date().toISOString() })
      .in("account_id", accountIds)
      .eq("stage", "candidates"); // обновляем ТОЛЬКО кандидатов

    if (error) {
      console.error("Failed to update debts to 'new':", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      message: `${accountIds.length} records moved to 'new' stage`,
    });
  } catch (err) {
    console.error("Unexpected error in /debts/batch-to-new:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /debts/batch-to-candidates
app.post("/debts/batch-to-candidates", async (req, res) => {
  const { accountIds } = req.body;

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return res
      .status(400)
      .json({ error: "accountIds must be a non-empty array" });
  }

  try {
    const { error } = await supabase
      .from("debt")
      .update({ stage: "candidates", updated_at: new Date().toISOString() })
      .in("account_id", accountIds)
      .eq("stage", "new"); // возвращаем ТОЛЬКО те, что сейчас в 'new'

    if (error) {
      console.error("Failed to revert debts to 'candidates':", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      message: `${accountIds.length} records reverted to 'candidates'`,
    });
  } catch (err) {
    console.error("Unexpected error in /debts/batch-to-candidates:", err);
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
