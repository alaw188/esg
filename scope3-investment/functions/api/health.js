import { MODELS, DEFAULT_MODEL, jsonResponse } from "../_lib.js";

export async function onRequest(context) {
  return jsonResponse({
    ok: true,
    default: DEFAULT_MODEL,
    models: Object.entries(MODELS).map(([key, m]) => ({
      key,
      label: m.label,
      id: m.id,
      hasKey: Boolean(m.apiKey),
    })),
  });
}
