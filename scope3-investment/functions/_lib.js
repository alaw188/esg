// Shared code for Cloudflare Pages Functions

export const MODELS = {
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

export const DEFAULT_MODEL = "minimax";
export const RETRIES = 1;

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

export function parseTicker(input) {
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
    ? `\nHINT: HKEX code ${parsed.symbol} most often maps to ${HK_HINTS[parsed.symbol]}. Verify the mapping.`
    : "";

  const retryNote = attempt > 0
    ? `\nPREVIOUS ATTEMPT FAILED. Provide BEST ESTIMATE with confidence "low" rather than error.`
    : "";

  return `You are a meticulous ESG / carbon-accounting research analyst... (full prompt below)

Identifier: ${parsed.display}
Market: ${marketLabel}${hint}${retryNote}

TASK: Find the MOST RECENT publicly disclosed GHG emissions for the EXACT company. Today is ${YEAR}. Prioritize ${YEAR} or ${PREV} data.

Return ONLY valid JSON:
{"ticker":"${parsed.display}","market":"${parsed.market}","name":"...","nameZh":"...","scope1":<number>,"scope2":<number>,"reportingYear":<YYYY>,"totalSharesOutstanding":<number|null>,"sharePrice":<number|null>,"enterpriseValue":<number|null>,"currency":"${parsed.market === "HK" ? "HKD" : "USD"}","confidence":"high|medium|low","dataSource":"..."}

RULES:
- scope1, scope2 ≥ 0. Prefer ${YEAR} or ${PREV}. If only older data exists → confidence "low" + staleness note.
- If cannot identify company → {"error":"找不到 ${parsed.display} 對應的公司，請確認股票代號是否正確"}
- Unknown numerics → null. No text outside JSON.`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
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
  if (!raw || typeof raw !== "object") return { error: "AI 回應格式錯誤" };
  if (raw.error) return { error: String(raw.error) };
  const name = (raw.name || "").toString().trim();
  if (!name) return { error: `找不到 ${parsed.display} 對應的公司，請確認股票代號是否正確` };
  const scope1 = toNumber(raw.scope1);
  const scope2 = toNumber(raw.scope2);
  if (!Number.isFinite(scope1) || !Number.isFinite(scope2) || scope1 < 0 || scope2 < 0) {
    return { error: `無法取得 ${parsed.display} 可靠的範圍一／二排放數據` };
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

export async function queryModel(parsed, attempt, modelKey) {
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

export async function fetchEmissions(parsed, modelKey) {
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

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
