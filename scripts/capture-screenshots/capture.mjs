// Capture README screenshots from a running stack (docker compose up).
//
//   cd scripts/capture-screenshots
//   npm install && npx playwright install chromium
//   node capture.mjs                     # defaults: web :3000, api :8000
//   WEB_URL=http://localhost:3000 API_URL=http://localhost:8000/api/v1 node capture.mjs
//   CHROMIUM_PATH=/path/to/chrome node capture.mjs   # use an already-installed browser
//
// Logs in with the seeded demo accounts and writes 1440x900 PNGs to image/.
// The AI chat shot uses a mocked SSE response (no Gemini key, no API call);
// the key stored in the browser for that shot is a placeholder and is never shown.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../image");
const VIEWPORT = { width: 1440, height: 900 };

async function settle(page) {
  await page.waitForLoadState("networkidle");
  // Skeleton placeholders and entry animations
  await page.waitForFunction(() => !document.querySelector(".skeleton, [data-skeleton]"), null, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(900);
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`saved image/${name}.png`);
}

async function login(page, username, password) {
  await page.goto(`${WEB}/login`);
  await page.fill("input[name=username]", username);
  await page.fill("input[name=password]", password);
  await Promise.all([page.waitForURL(/\/(home|admin)/), page.click("button[type=submit]")]);
}

function mockChatStream(question) {
  const events = [
    ["start", { message_id: "mock" }],
    ["tool_call", { name: "list_buds", args: { deadline_within_days: 7 } }],
    ["tool_result", { name: "list_buds", result: { ok: true, message: "봉우리 4개", data: {} } }],
    ["tool_call", { name: "list_calendar_events", args: {} }],
    ["tool_result", { name: "list_calendar_events", result: { ok: true, message: "일정 3개", data: {} } }],
  ];
  const answer =
    "오늘 할 일을 정리했어요.\n\n" +
    "1. **A사 서류 마감** — 자기소개서 3번 문항 작성 (현재 40%)\n" +
    "2. **코딩 테스트** — 골드 문제 1개 풀기\n" +
    "3. **영어 단어 30개** — 85%라 곧 수확할 수 있어요\n\n" +
    "`밤 12시 전에 잠들기`가 시들고 있으니 오늘은 일찍 쉬어 보세요.";
  const body = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("") +
    answer.split(" ").map((w) => `event: token\ndata: ${JSON.stringify({ text: w + " " })}\n\n`).join("") +
    "event: done\ndata: {}\n\n";
  void question;
  return body;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "ko-KR", colorScheme: "light" });
  const page = await context.newPage();

  // Public pages
  await page.goto(`${WEB}/`);
  await shot(page, "landing");
  await page.goto(`${WEB}/login`);
  await shot(page, "login");

  // Demo user
  await login(page, "demo", "demo1234");
  await shot(page, "dashboard");

  await page.goto(`${WEB}/plants`);
  await shot(page, "garden");

  const plants = await (await page.request.get(`${API}/plants`)).json();
  const job = plants.data.items.find((p) => p.name === "취업 준비") ?? plants.data.items[0];
  await page.goto(`${WEB}/plants/${job.id}`);
  await shot(page, "plant-detail");
  await page.getByText("포트폴리오 사이트 리뉴얼").first().click();
  await shot(page, "bud-detail");

  await page.goto(`${WEB}/calendar`);
  await shot(page, "calendar");

  await page.goto(`${WEB}/history`);
  await shot(page, "history");

  // AI chat without a key → feature disabled with a key prompt
  await page.goto(`${WEB}/settings`);
  await settle(page);
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await shot(page, "settings-api-key");

  await page.goto(`${WEB}/home`);
  await settle(page);
  await page.getByRole("button", { name: "AI 대화" }).click();
  await shot(page, "ai-chat-no-key");

  // AI chat with a placeholder key and a mocked streaming answer
  await page.evaluate(() => localStorage.setItem("pc-gemini-api-key", "placeholder-key-for-screenshots"));
  await page.route("**/chat/message", async (route) => {
    const origin = route.request().headers()["origin"] ?? WEB;
    const cors = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Content-Type, X-Gemini-Api-Key",
      "access-control-allow-methods": "POST",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body: mockChatStream() });
  });
  await page.reload();
  await settle(page);
  if (!(await page.locator("textarea").count())) await page.getByRole("button", { name: "AI 대화" }).click();
  await page.fill("textarea", "오늘 뭐부터 하면 좋을까?");
  await page.keyboard.press("Enter");
  await page.getByText("일찍 쉬어 보세요").waitFor();
  await shot(page, "ai-chat");
  await page.unroute("**/chat/message");
  await page.evaluate(() => localStorage.removeItem("pc-gemini-api-key"));

  // Admin
  await context.clearCookies();
  await login(page, "admin", "admin1234");
  await page.goto(`${WEB}/admin`);
  await shot(page, "admin-dashboard");
  await page.goto(`${WEB}/admin/logs`);
  await shot(page, "admin-ai-logs");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
