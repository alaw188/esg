/**
 * Scope 3 (Category 15 — Investments) emissions calculator.
 *
 * Zero-dependency Node.js server.
 * Serves index.html as a static site AND handles /api/health + /api/emissions.
 *
 * Deploy to Render / Railway / Fly.io / any Node host:
 *   Start command: node server.js
 *
 * No API_BASE config needed — everything runs on ONE URL.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// =============================================================================
// Model registry
// =============================================================================
const MODELS = {
  minimax: {
    label: "NVIDIA MiniMax M3",
    id: "minimaxai/minimax-m3",
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey:
      "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",
    topP: 0.95,
    extra: {},
    maxTokens: 8192,
  },
  groq: {
    label: "Groq Llama 3.1 8B Instant",
    id: "llama-3.1-8b-instant",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey:
      "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",
    topP: 1,
    extra: {},
    maxTokens: 4096,
  },
};
const DEFAULT_MODEL = "minimax";
const RETRIES = 1;

// =============================================================================
// HKEX hints
// =============================================================================
const HK_HINTS = {
  "0001": "CK Hutchison Holdings (長江和記實業)",
  "0002": "CLP Holdings (中電控股)",
  "0003": "The Hong Kong and China Gas (香港中華煤氣)",
  "0005": "HSBC Holdings (匯豐控股)",
  "0006": "Power Assets Holdings (電能實業)",
  "0011": "Hang Seng Bank (恒生銀行)",
  "0012": "Henderson Land Development (恒基兆業地產)",
  "0016": "Sun Hung Kai Properties (新鴻基地產)",
  "0017": "New World Development (新世界發展)",
  "0019": "Swire Pacific (太古股份)",
  "0023": "Bank of East Asia (東亞銀行)",
  "0267": "CITIC Limited (中信股份)",
  "0386": "Sinopec (中國石油化工 / 中石化)",
  "0388": "Hong Kong Exchanges and Clearing (香港交易所 / HKEX)",
  "0392": "Beijing Enterprises Holdings (北京控股)",
  "0700": "Tencent Holdings (騰訊控股)",
  "0762": "China Unicom (中國聯通)",
  "0857": "PetroChina (中國石油)",
  "0883": "CNOOC (中國海洋石油)",
  "0939": "China Construction Bank (建設銀行)",
  "0941": "China Mobile (中國移動)",
  "1038": "China Railway Group (中國中鐵)",
  "1093": "CSPC Pharmaceutical (石藥集團)",
  "1109": "China Resources Land (華潤置地)",
  "1299": "AIA Group (友邦保險)",
  "1398": "Industrial and Commercial Bank of China (工商銀行)",
  "1810": "Xiaomi (小米集團)",
  "2007": "Country Garden (碧桂園)",
  "2318": "Ping An Insurance (中國平安)",
  "2388": "BOC Hong Kong (中銀香港)",
  "2628": "China Life (中國人壽)",
  "3328": "Bank of Communications (交通銀行)",
  "3988": "Bank of China (中國銀行)",
  "3968": "China Merchants Bank (招商銀行)",
  "9618": "JD.com (京東集團)",
  "9988": "Alibaba Group (阿里巴巴)",
};

// =============================================================================
// Helpers
// =============================================================================
function parseTicker(input) {
  const trimmed = (input || "").trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.endsWith(".HK")) {
    const sym = trimmed.slice(0, -3).replace(/^0+/, "") || "0";
    return { symbol: sym.padStart(4, "0"), market: "HK", display: sym.padStart(4, "0") + ".HK" };
  }
  if (trimmed.endsWith(".US")) {
    return { symbol: trimmed.slice(0, -3), market: "US", display: trimmed.slice(0, -3) };
  }
  if (/^\d{1,5}$/.test(trimmed)) {
    return { symbol: trimmed.padStart(4, "0"), market: "HK", display: trimmed.padStart(4, "0") + ".HK" };
  }
  if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(trimmed)) {
    return { symbol: trimmed, market: "US", display: trimmed };
  }
  return null;
}

function buildPrompt(parsed, attempt = 0) {
  const YEAR = new Date().getFullYear();
  const PREV = YEAR - 1;
  const marketLabel = parsed.market === "HK"
    ? "Hong Kong Stock Exchange (HKEX)"
    : "United States (NYSE / NASDAQ)";

  const hint = parsed.market === "HK" && HK_HINTS[parsed.symbol]
    ? `\nHINT: HKEX code ${parsed.symbol} most often maps to ${HK_HINTS[parsed.symbol]}. Verify the mapping — do not assume it blindly.`
    : "";

  const retryNote = attempt > 0
    ? `\nPREVIOUS ATTEMPT FAILED or returned no usable data. Re-examine the identifier carefully. If you can identify the company but lack precise figures, provide your BEST ESTIMATE with confidence "low" rather than returning an error. Never invent a company name.`
    : "";

  return `You are a meticulous ESG / carbon-accounting research analyst with deep knowledge of publicly listed companies, especially in the United States (NYSE/NASDAQ) and Hong Kong (HKEX).

Identifier: ${parsed.display}
Market: ${marketLabel}${hint}${retryNote}

TASK: Find the MOST RECENT publicly disclosed greenhouse-gas (GHG) emissions for the EXACT company trading under this identifier, sourced from its official sustainability / ESG report, annual report, or CDP disclosure. Today is ${YEAR}; you MUST prioritize the newest available reporting year — ideally ${YEAR} (current year) or ${PREV} (previous year). Actively look for the latest ESG / sustainability report and report its publication year.

Return ONLY a single valid JSON object (no markdown fences, no prose before or after):
{
  "ticker": "${parsed.display}",
  "market": "${parsed.market}",
  "name": "Exact English legal name",
  "nameZh": "Exact Chinese name, or empty string if not applicable",
  "scope1": <number, absolute annual tCO2e>,
  "scope2": <number, absolute annual tCO2e; market-based if reported, else location-based>,
  "reportingYear": <YYYY>,
  "totalSharesOutstanding": <number, or null>,
  "sharePrice": <number, most recent in local currency, or null>,
  "enterpriseValue": <number in local currency, or null>,
  "currency": "${parsed.market === "HK" ? "HKD" : "USD"}",
  "confidence": "high" | "medium" | "low",
  "dataSource": "Report name + year, e.g. 'Tencent ESG Report 2023'"
}

STRICT RULES:
- scope1 and scope2 are absolute annual emissions in tonnes CO2-equivalent (tCO2e). They MUST be non-negative numbers.
- Prefer reporting year ${YEAR} or ${PREV}. You MUST NOT use data older than ${PREV} unless nothing newer exists — and if the only figures you can find are from ${PREV - 1} or earlier, you MUST set confidence to "low" and append a staleness note to dataSource, e.g. "Apple ESG Report 2022 (older than preferred ${PREV})".
- If you can identify the company but cannot locate any ${YEAR} or ${PREV} disclosure, still return the best available figure with confidence "low" and state the actual reportingYear; never present stale data as if it were current.
- Do NOT invent a company. If you cannot confidently identify the correct company for this identifier, return exactly:
  {"error":"找不到 ${parsed.display} 對應的公司，請確認股票代號是否正確"}
- If you identify the company but cannot find reliable Scope 1/2 figures, return the best estimate you have with confidence "low".
- Unknown numeric fields: use null. Never add explanations outside the JSON object.`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/,/g, "").trim());
  if (v && typeof v === "object") {
    const pick = v.marketBased ?? v.locationBased ?? v.total ?? v.value;
    return typeof pick === "number" ? pick : Number(pick);
  }
  return NaN;
}

function normalizeAndValidate(raw, parsed) {
  if (!raw || typeof raw !== "object") return { error: "AI 回應格式錯誤，請稍後再試" };
  if (raw.error) return { error: String(raw.error) };
  const name = (raw.name || "").toString().trim();
  if (!name) return { error: `找不到 ${parsed.display} 對應的公司，請確認股票代號是否正確` };
  const scope1 = toNumber(raw.scope1);
  const scope2 = toNumber(raw.scope2);
  if (!Number.isFinite(scope1) || !Number.isFinite(scope2) || scope1 < 0 || scope2 < 0) {
    return { error: `無法取得 ${parsed.display} 可靠的範圍一／範圍二排放數據` };
  }
  const total = scope1 + scope2;
  let confidence = ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "medium";
  if (total === 0) confidence = "low";
  return {
    ticker: parsed.display,
    market: parsed.market,
    name,
    nameZh: (raw.nameZh || "").toString().trim(),
    scope1,
    scope2,
    reportingYear: Number(raw.reportingYear) || null,
    totalSharesOutstanding: (() => { const n = toNumber(raw.totalSharesOutstanding); return Number.isFinite(n) && n > 0 ? n : null; })(),
    sharePrice: (() => { const n = toNumber(raw.sharePrice); return Number.isFinite(n) && n > 0 ? n : null; })(),
    enterpriseValue: (() => { const n = toNumber(raw.enterpriseValue); return Number.isFinite(n) && n > 0 ? n : null; })(),
    currency: parsed.market === "HK" ? "HKD" : "USD",
    confidence,
    dataSource: (raw.dataSource || "").toString().trim() || null,
    error: null,
  };
}

// =============================================================================
// Model query
// =============================================================================
async function queryModel(parsed, attempt, modelKey) {
  const m = MODELS[modelKey];
  const payload = {
    model: m.id,
    messages: [{ role: "user", content: buildPrompt(parsed, attempt) }],
    temperature: 1,
    top_p: m.topP,
    max_tokens: m.maxTokens || 16384,
    ...m.extra,
    stream: false,
  };

  const resp = await fetch(m.baseURL + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + m.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(m.label + " API HTTP " + resp.status + " " + body.slice(0, 200));
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error(m.label + " API 回傳非 JSON 內容");
  }
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) throw new Error(m.label + " API 回傳空白內容");

  let raw;
  try {
    raw = extractJson(content);
  } catch {
    return { error: "AI 回應格式錯誤，請稍後再試", raw: content.slice(0, 200) };
  }
  return normalizeAndValidate(raw, parsed);
}

async function fetchEmissions(parsed, modelKey) {
  const mk = MODELS[modelKey] ? modelKey : DEFAULT_MODEL;
  if (!MODELS[mk].apiKey) {
    return { error: `未設定 ${mk} 模型的 API 金鑰` };
  }
  let last = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      last = await queryModel(parsed, attempt, mk);
    } catch (err) {
      last = { error: "查詢失敗：" + err.message };
    }
    if (last && !last.error) break;
  }
  return { ...(last || {}), model: mk };
}

// =============================================================================
// HTTP server
// =============================================================================
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown",
  ".map": "application/json",
};

function serveStatic(req, res, url) {
  let filePath = path.join(DIR, url.pathname === "/" ? "index.html" : url.pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // File not found → serve index.html (SPA-friendly, also handles page refreshes)
      fs.readFile(path.join(DIR, "index.html"), (err2, data2) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // CORS headers (needed only if accessed from a different origin in dev)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API routes ---
  if (url.pathname === "/api/health") {
    const body = JSON.stringify({
      ok: true,
      default: DEFAULT_MODEL,
      models: Object.entries(MODELS).map(([key, m]) => ({
        key,
        label: m.label,
        id: m.id,
        hasKey: Boolean(m.apiKey),
      })),
    });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
    return;
  }

  if (url.pathname === "/api/emissions") {
    const ticker = url.searchParams.get("ticker");
    const modelKey = url.searchParams.get("model") || DEFAULT_MODEL;
    if (!ticker) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "缺少 ticker 參數" }));
      return;
    }
    if (!MODELS[modelKey]) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "不支援的模型：" + modelKey }));
      return;
    }
    const parsed = parseTicker(ticker);
    if (!parsed) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "無效的股票代號格式" }));
      return;
    }

    fetchEmissions(parsed, modelKey)
      .then((data) => {
        res.writeHead(data.error ? 404 : 200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(data));
      })
      .catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "查詢失敗：" + err.message }));
      });
    return;
  }

  // --- Static files ---
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`✓ Scope 3 emissions server running on http://localhost:${PORT}`);
  console.log(`  Default model: ${DEFAULT_MODEL} (${MODELS[DEFAULT_MODEL].label})`);
  console.log(`  Models available: ${Object.keys(MODELS).join(", ")}`);
});
