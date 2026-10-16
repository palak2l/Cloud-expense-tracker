const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-value-32chars!!";
process.env.COOKIE_SECURE = "false";
process.env.STORAGE_DRIVER = "local";
process.env.DATABASE_PATH = path.join(os.tmpdir(), `cet-test-${Date.now()}.sqlite`);
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `cet-uploads-${Date.now()}`);

const { openDatabase } = require("../src/db/database");
const { createApp } = require("../src/app");

const db = openDatabase(process.env.DATABASE_PATH);
const app = createApp(db);

function agent() {
  return request.agent(app);
}

async function csrf(client) {
  const res = await client.get("/api/auth/csrf").expect(200);
  return res.body.csrfToken;
}

async function register(client, email, name = "Palak Lodha") {
  const res = await client
    .post("/api/auth/register")
    .send({ name, email, password: "securePass1" })
    .expect(201);
  return res.body;
}

test("health endpoint is public", async () => {
  const res = await request(app).get("/health").expect(200);
  assert.equal(res.body.ok, true);
});

test("register hashes passwords and creates a session", async () => {
  const client = agent();
  const body = await register(client, "palak@example.com");
  assert.equal(body.user.email, "palak@example.com");
  assert.ok(!body.user.password_hash);
  const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get("palak@example.com");
  assert.ok(row.password_hash);
  assert.notEqual(row.password_hash, "securePass1");
  await client.get("/api/auth/me").expect(200);
});

test("duplicate email is rejected", async () => {
  const client = agent();
  await register(client, "dup@example.com");
  const res = await agent()
    .post("/api/auth/register")
    .send({ name: "Other", email: "dup@example.com", password: "securePass1" })
    .expect(409);
  assert.match(res.body.error, /already exists/i);
});

test("login rejects bad passwords and accepts good ones", async () => {
  await register(agent(), "login@example.com");
  const bad = await agent()
    .post("/api/auth/login")
    .send({ email: "login@example.com", password: "wrong-password" })
    .expect(401);
  assert.match(bad.body.error, /Invalid/);
  const good = await agent()
    .post("/api/auth/login")
    .send({ email: "login@example.com", password: "securePass1" })
    .expect(200);
  assert.equal(good.body.user.email, "login@example.com");
});

test("mutating APIs require CSRF after login", async () => {
  const client = agent();
  await register(client, "csrf@example.com");
  const res = await client.post("/api/transactions").send({
    type: "expense",
    category: "Food",
    amount: 10,
    date: "2026-10-01",
    description: "no csrf"
  });
  assert.equal(res.status, 403);
});

test("dashboard figures come from the authenticated user's records", async () => {
  const alice = agent();
  const a = await register(alice, "alice@example.com", "Alice");
  const tokenA = a.csrfToken;
  await alice
    .post("/api/transactions")
    .set("X-CSRF-Token", tokenA)
    .send({ type: "income", category: "Salary", amount: 1000, date: "2026-10-01", description: "Pay" })
    .expect(201);
  await alice
    .post("/api/transactions")
    .set("X-CSRF-Token", tokenA)
    .send({ type: "expense", category: "Food", amount: 250, date: "2026-10-02", description: "Lunch" })
    .expect(201);

  const bob = agent();
  const b = await register(bob, "bob@example.com", "Bob");
  await bob
    .post("/api/transactions")
    .set("X-CSRF-Token", b.csrfToken)
    .send({ type: "expense", category: "Travel", amount: 80, date: "2026-10-03", description: "Bus" })
    .expect(201);

  const summaryA = await alice.get("/api/dashboard/summary").expect(200);
  assert.equal(summaryA.body.summary.totalIncome, 1000);
  assert.equal(summaryA.body.summary.totalExpense, 250);
  assert.equal(summaryA.body.summary.balance, 750);

  const listB = await bob.get("/api/transactions").expect(200);
  assert.equal(listB.body.transactions.length, 1);
  assert.equal(listB.body.transactions[0].category, "Travel");
  assert.ok(listB.body.transactions.every((row) => row.category !== "Food"));
});

test("users cannot edit another user's transaction", async () => {
  const owner = agent();
  const o = await register(owner, "owner@example.com");
  const created = await owner
    .post("/api/transactions")
    .set("X-CSRF-Token", o.csrfToken)
    .send({ type: "expense", category: "Bills", amount: 40, date: "2026-10-04", description: "Net" })
    .expect(201);

  const stranger = agent();
  const s = await register(stranger, "stranger@example.com");
  await stranger
    .put(`/api/transactions/${created.body.transaction.id}`)
    .set("X-CSRF-Token", s.csrfToken)
    .send({ type: "expense", category: "Bills", amount: 1, date: "2026-10-04", description: "hack" })
    .expect(404);
});

test("budget warnings appear when spending exceeds the limit", async () => {
  const client = agent();
  const body = await register(client, "budget@example.com");
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  await client
    .put("/api/budgets")
    .set("X-CSRF-Token", body.csrfToken)
    .send({ category: "Food", month, amount: 100 })
    .expect(200);
  await client
    .post("/api/transactions")
    .set("X-CSRF-Token", body.csrfToken)
    .send({ type: "expense", category: "Food", amount: 120, date: `${month}-10`, description: "Groceries" })
    .expect(201);
  const summary = await client.get("/api/dashboard/summary").expect(200);
  assert.ok(summary.body.warnings.some((item) => /Food is over budget/i.test(item)));
});

test("receipt upload is stored and only the owner can fetch it", async () => {
  const owner = agent();
  const o = await register(owner, "receipts@example.com");
  const created = await owner
    .post("/api/transactions")
    .set("X-CSRF-Token", o.csrfToken)
    .send({ type: "expense", category: "Healthcare", amount: 15, date: "2026-10-05", description: "Pharmacy" })
    .expect(201);

  const filePath = path.join(os.tmpdir(), "receipt-test.png");
  fs.writeFileSync(filePath, Buffer.from("89504e470d0a1a0a", "hex"));
  await owner
    .post(`/api/receipts/${created.body.transaction.id}`)
    .set("X-CSRF-Token", o.csrfToken)
    .attach("receipt", filePath)
    .expect(201);

  const url = await owner.get(`/api/receipts/${created.body.transaction.id}/url`).expect(200);
  assert.ok(url.body.url);

  const stranger = agent();
  const s = await register(stranger, "noreceipt@example.com");
  await stranger
    .get(`/api/receipts/${created.body.transaction.id}/url`)
    .set("X-CSRF-Token", s.csrfToken)
    .expect(404);
});

test("CSV export contains the user's transactions", async () => {
  const client = agent();
  const body = await register(client, "csv@example.com");
  await client
    .post("/api/transactions")
    .set("X-CSRF-Token", body.csrfToken)
    .send({ type: "income", category: "Other", amount: 50, date: "2026-09-01", description: "Gift, family" })
    .expect(201);
  const res = await client.get("/api/transactions/export").expect(200);
  assert.match(res.headers["content-type"], /text\/csv/);
  assert.match(res.text, /Gift, family/);
});

test("invalid transaction payloads are rejected", async () => {
  const client = agent();
  const body = await register(client, "invalid@example.com");
  const res = await client
    .post("/api/transactions")
    .set("X-CSRF-Token", body.csrfToken)
    .send({ type: "expense", category: "Spaceships", amount: -3, date: "not-a-date" })
    .expect(400);
  assert.ok(res.body.error);
});
