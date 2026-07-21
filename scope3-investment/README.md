# 範圍三碳排放計算平台

計算 **GHG Protocol 範圍三第 15 分類（投資）** 碳排放，支援任意香港及美國上市公司。排放數據由 AI（NVIDIA NIM 模型 `nvidia/nemotron-3-nano-30b-a3b`）根據其訓練知識，從公司最新可持續發展報告估算。

## 架構

本平台為**獨立可部署**的兩檔方案，不依賴任何前端框架：

| 檔案 | 用途 |
|------|------|
| `index.html` | 前端計算器界面（純 HTML/CSS/JS，無框架） |
| `server.js` | Node.js 靜態伺服器 + NVIDIA API 代理（OpenAI SDK 模式，`base_url` 指向 NVIDIA NIM） |

> 本專案早期曾含一套 Next.js 實作（`src/`），其使用靜態示範數據、僅支援有限股票，且是原始「找不到股票代號」錯誤的來源。該版本已移除；現行 `index.html` + `server.js` 為唯一且完整的實作。

## 快速部署

### 1. 設定 API 金鑰

```bash
cp .env.example .env
# 編輯 .env，填入 NVIDIA_API_KEY
```

> `.env` 已預設包含一個 NVIDIA API 金鑰，可直接使用；正式部署請替換為你自己的金鑰，或透過環境變數 `NVIDIA_API_KEY` 注入（金鑰只應放在伺服器端，切勿寫入 `index.html` 或提交到 Git）。

### 2. 啟動伺服器

```bash
npm install
npm run serve          # 等同 node server.js
```

打開 **http://localhost:8080**

## ⚠️ 必須透過伺服器執行（不能雙擊開啟 index.html）

`index.html` **無法**直接以 `file://` 雙擊開啟使用，原因有二：

1. 它會向相對路徑 `/api/emissions` 發送 `fetch` 請求，此路徑必須由 `server.js` 提供；
2. NVIDIA API 金鑰僅存放於伺服器端 `.env`，`file://` 模式下沒有代理層可替你呼叫 API。

**正確做法**：一律透過 `npm run serve`（或 `node server.js`）啟動，再於瀏覽器開啟 `http://localhost:8080`。

## 功能

- 輸入**任意**美國（`AAPL`）或香港（`0012`、`0700.HK`）股票代號
- AI 自動辨識公司並估算其最新範圍一、二排放（NVIDIA NIM 模型）
- 投資組合表格：新增、修改持股、重新查詢、移除
- **手動輸入後備**：若 AI 未能辨識某股票（例如冷門港股代號），可直接手動填入該公司排放數據繼續計算 — 不再受限於固定股票清單
- 按 PCAF 標準計算範圍三融資排放
- 點擊「**匯出 PDF 報告**」可產生一份可列印／另存為 PDF 的報告，內含每一筆計算所引用的原始數據（股價、總股本、企業價值、持股數、範圍一、二排放、報告年度、數據來源等）與歸屬因子、融資排放等中間值，供內部審計追溯（Traceability）
- 點擊「**計算方法說明**」按鈕，可查看完整方法論：適用標準、PCAF 公式、數據來源說明（數據從哪裡來）、信心等級（高／中／低如何辨識）與免責聲明
- 本地快取（24 小時）減少 API 調用
- 持倉自動儲存於瀏覽器（localStorage）

## 計算方法（PCAF + GHG Protocol）

```
歸屬因子 (Attribution Factor) = 投資市值 ÷ 企業價值（EVIC）
投資市值 (MVI)               = 持股數量 × 股價
融資排放 (Financed Emissions) = 歸屬因子 ×（被投資公司範圍一、二排放）
```

若企業價值（EVIC）未知，則退而使用股權比例：`歸屬因子 = 持股數量 ÷ 總流通股數`。

這對應 **PCAF《金融業 GHG 核算標準》— 上市股權與公司債（Listed Equity & Corporate Bonds）** 的歸屬因子法。詳細說明請見平台內「計算方法說明」面板。

## API

```
GET /api/emissions?ticker=0012                 # 香港代號 -> 恒基兆業（HKEX 0012）
GET /api/emissions?ticker=AAPL                # 蘋果（預設模型 nemotron）
GET /api/emissions?ticker=AAPL&model=gemma    # 改用 Google Gemma 4 查詢
GET /api/emissions?ticker=0700.HK             # 騰訊
GET /api/health                              # 檢查 API 金鑰與可用模型
```

- `?model=` 可切換模型（預設 `nemotron`）。可用值由 `/api/health` 的 `models[]` 回傳。
- 快取以 **模型 + 股票** 為鍵，切換模型會重新查詢，切回則直接使用快取。

回傳欄位：`name`、`nameZh`、`scope1`、`scope2`、`reportingYear`、`totalSharesOutstanding`、`sharePrice`、`enterpriseValue`、`currency`、`confidence`（high/medium/low）、`dataSource`、`model`（實際使用的模型鍵，如 `nemotron` / `gemma`）。

## 切換 AI 模型（Model Switcher）

平台支援在介面上切換不同的 NVIDIA NIM 模型，方便比較不同模型的估算結果。

- 工具列中的 **「AI 模型」下拉選單** 列出所有已註冊模型（由 `/api/health` 動態載入）。
- 選擇會記住於瀏覽器（localStorage），下次開啟自動沿用。
- 切換模型後，現有持倉會**自動以新模型重新查詢**（各自獨立快取，切回舊模型即時取用）。
- 每一筆資料的「數據來源」標籤會附註所用模型，PDF 報告亦會列出本報告涵蓋的模型，確保可追溯。

目前內建兩個模型（`server.js` 的 `MODELS` 註冊表，可自由增減）：

| 鍵值 | 模型 | 專屬金鑰環境變數 | 模型特有參數 |
|------|------|------------------|--------------|
| `nemotron` | `nvidia/nemotron-3-nano-30b-a3b` | `NVIDIA_API_KEY` | `reasoning_budget=16384`、`top_p=1`、`max_tokens=16384` |
| `gemma`   | `google/gemma-4-31b-it`            | `NVIDIA_API_KEY_GEMMA` | `chat_template_kwargs.enable_thinking=true`、`top_p=0.95`、`max_tokens=16384` |
| `minimax` | `minimaxai/minimax-m3`             | `NVIDIA_API_KEY_GEMMA`（與 gemma 共用同一把金鑰） | `top_p=0.95`、`max_tokens=8192` |

> 每個模型使用**各自獨立**的 NVIDIA API 金鑰（不同模型金鑰不同）。請分別在 `.env`
> 設定 `NVIDIA_API_KEY` 與 `NVIDIA_API_KEY_GEMMA`；金鑰只應存放於伺服器端，切勿寫入前端或提交 Git。
> 若某模型金鑰缺失，`/api/emissions` 會回傳該模型的金鑰未設定錯誤，不影響其他模型。

## 關於「AI 估算」的重要說明

本平台使用的 NVIDIA NIM 模型 **本身不具備網頁瀏覽能力**，無法真正即時抓取企業官網上「最新」的永續報告 PDF。它回傳的數據來自其**訓練知識**，並會標註其認為的 `reportingYear` 與 `confidence`。

因此：

- 對知名公司（Apple、Microsoft、Tencent、HSBC 等）數據通常可靠；
- 對冷門或近期上市的公司，模型可能無法辨識 — 此時請使用「手動輸入」後備；
- 本平台僅供**內部估算參考**，不作為合規披露依據。正式用途請接入 CDP、Bloomberg、Moody's 等權威 ESG 數據庫，或以企業官方報告核實。

## 數據新鮮度（年度偏置機制）

由於模型**無法上網**，它只能「回想」訓練知識中最新認知的報告年度，而不能即時定位企業官網上「最新」的 ESG 報告。為盡可能貼近用戶對「最新數據」的期待，伺服器端（`server.js` 的 `buildPrompt`）會：

1. **伺服器端即時計算**當前年度與上一年（例如 2026 年 7 月運行時為 `YEAR=2026`、`PREV=2025`），並將其注入提示詞；
2. 要求模型**優先採用當前或上一年**的 ESG／永續報告，並回報其發布年度；
3. 若模型**只能回想出早於前一年的數據**（例如僅知 2023），則強制將 `confidence` 設為 `low`，並在 `dataSource` 附加過期提示，例如：
   `"Henderson Land Development ESG Report 2023 (older than preferred 2025)"`；
4. 絕不把過期數據偽裝成當期數據。

> ⚠️ 這套機制是**「偏向上最新」的最佳努力（best-effort recency bias）**，而非「保證抓到最新報告」。若模型的訓練知識尚未涵蓋該公司最新一年度（2025/2026）的披露，平台會誠實以 `low` 信心與過期註記呈現，而非憑空編造。要取得真正即時、經驗證的數據，仍須接入可瀏覽網頁的資料源或權威 ESG 數據庫。

## 查詢延遲說明

預設模型為 `nvidia/nemotron-3-nano-30b-a3b`。每次推論視模型負載與 `reasoning_budget` 預算，約需數十秒至數分鐘。首次查詢某股票時請耐心等候（介面會顯示「查詢中…」）；查詢結果會快取 **24 小時**，期間內重複查詢即時返回。可透過環境變數調整：

```bash
API_MAX_TOKENS=16384          # 最大輸出 token
API_REASONING_BUDGET=16384   # 推理預算
API_RETRIES=1                # 失敗重試次數
PORT=8080                    # 伺服器端口
```

## 關於 `reasoning_budget` 的實作備註

用戶端以 OpenAI SDK 模式呼叫 NVIDIA：

```js
const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});
await client.chat.completions.create({
  model: "nvidia/nemotron-3-nano-30b-a3b",
  messages: [...],
  temperature: 1,
  top_p: 1,
  max_tokens: 16384,
  reasoning_budget: 16384,   // 直接作為 body 欄位傳遞
  stream: true,
});
```

> **注意**：OpenAI **Node** SDK（v6.x）並不會像 Python SDK 那樣將 `extra_body` 合併進請求本體，而是把 `extra_body` 當作字面頂層欄位原樣送出，導致 NVIDIA 報錯 `Unsupported parameter(s): extra_body`。NVIDIA 接受 `reasoning_budget` 作為直接 body 欄位，因此本專案直接傳遞 `reasoning_budget`，達成與預期相同的線上 payload。

## 部署到雲端

將整個專案部署到任何支援 Node.js 的平台（Railway、Render、Fly.io、VPS 等）：

```bash
npm install
NVIDIA_API_KEY=your_key PORT=8080 node server.js
```

## 技術棧

- `index.html` — 純 HTML/CSS/JS，無框架依賴
- `server.js` — Node.js HTTP 伺服器 + NVIDIA NIM Chat Completions API（OpenAI SDK，`base_url` 指向 `integrate.api.nvidia.com/v1`）
- 依賴：`openai`、`dotenv`

## 安全提示

- API 金鑰只放在伺服器端 `.env` 檔案或環境變數
- `.env` 已在 `.gitignore` 中排除（本倉庫的 `.env` 為方便本地測試而保留，正式部署請自行替換）
