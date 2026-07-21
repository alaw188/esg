import { MODELS, DEFAULT_MODEL, parseTicker, fetchEmissions, jsonResponse } from "../_lib.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const ticker = url.searchParams.get("ticker");
  const modelKey = url.searchParams.get("model") || DEFAULT_MODEL;

  if (!ticker) return jsonResponse({ error: "缺少 ticker 參數" }, 400);
  if (!MODELS[modelKey]) return jsonResponse({ error: "不支援的模型：" + modelKey }, 400);

  const parsed = parseTicker(ticker);
  if (!parsed) return jsonResponse({ error: "無效的股票代號格式" }, 400);

  try {
    const data = await fetchEmissions(parsed, modelKey);
    return jsonResponse(data, data.error ? 404 : 200);
  } catch (err) {
    return jsonResponse({ error: "查詢失敗：" + err.message }, 500);
  }
}
