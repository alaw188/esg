# 範圍三碳排放計算平台

計算 **GHG Protocol 範圍三第 15 分類（投資）** 碳排放，支援任意香港及美國上市公司。排放數據由 AI（NVIDIA NIM 模型 `nvidia/nemotron-3-nano-30b-a3b`）根據其訓練知識，從公司最新可持續發展報告估算。

## 架構

本平台為**獨立可部署**的兩檔方案，不依賴任何前端框架：

| 檔案 | 用途 |
|------|------|
| `index.html` | 前端計算器界面（純 HTML/CSS/JS，無框架） |
| `server.js` | Node.js 靜態伺服器 + NVIDIA API 代理（**零依賴**，使用 Node 內建 `fetch` 呼叫 NVIDIA NIM `integrate.api.nvidia.com/v1`） |

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
node server.js          # 零依賴，直接執行即可（無須 npm install）
```

> 本專案**不依賴任何 npm 套件**（已改用 Node 內建 `fetch` 呼叫 NVIDIA，並以自帶的微型 `.env` 載入器取代 `dotenv`），因此不存在 `node_modules`，也不需要 `npm install`。

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

本專案以 Node 內建 `fetch` 直接呼叫 NVIDIA NIM 的 OpenAI 相容端點（`/v1/chat/completions`），並將 `reasoning_budget` 作為**直接 body 欄位**傳遞：

```js
await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "nvidia/nemotron-3-nano-30b-a3b",
    messages: [...],
    temperature: 1,
    top_p: 1,
    max_tokens: 16384,
    reasoning_budget: 16384,   // 直接作為 body 欄位傳遞
    stream: false,
  }),
});
```

> **注意**：早期版本使用 OpenAI **Node** SDK（v6.x）時，它並不會像 Python SDK 那樣將 `extra_body` 合併進請求本體，而是把 `extra_body` 當作字面頂層欄位原樣送出，導致 NVIDIA 報錯 `Unsupported parameter(s): extra_body`。現行版本已改用原生 `fetch`，直接把 `reasoning_budget` 放進 body 即可，無此問題，也無須安裝任何 SDK。

## 部署到雲端（重要）

> ⚠️ 本平台是 **Node.js 應用程式**，必須運行在「能執行 Node 的主機」上。它**不是純靜態網站**——前端 `index.html` 會呼叫 `/api/emissions`，該路由只能由 `server.js` 提供。若部署到「靜態主機」（如 **GitHub Pages**、Netlify Static 等），`server.js` 不會被執行，API 請求會拿到主機的 HTML 404 頁面，前端 `res.json()` 就會報 **`Unexpected token '<'`**。這正是「網站打開了、但查詢報錯」的典型原因。

### 第一步：處理 API 金鑰（.env 不上傳 Git）

- `.env` 含有金鑰，**絕對不要**提交到 Git（`.gitignore` 已排除 `.env`）。你看到「.env 無法上傳到 GitHub」是正常的、正確的行為。
- 倉庫內保留 **`.env.example`**（無金鑰，可安全提交）作為變數清單。
- 在雲端主機的 **環境變數設定頁**（dashboard）填入 `NVIDIA_API_KEY`、`NVIDIA_API_KEY_GEMMA`，**不要**上傳 `.env` 檔案本身。

### 第二步：選擇可執行 Node 的主機

**選項 A — Render / Railway / Fly.io（推薦，最簡單）**
1. 把本倉庫推送到 GitHub。
2. 在 Render / Railway 新建「Web Service」，連接該倉庫。
3. 啟動命令（Start Command）填：`node server.js`
4. 在環境變數設定頁加入：
   - `NVIDIA_API_KEY=你的金鑰`
   - `NVIDIA_API_KEY_GEMMA=你的金鑰`（Gemma / MiniMax 共用）
   - `PORT` 由平台自動提供，不用手填
5. 部署完成後，平台給你的網址即可線上使用。

**選項 B — 自有 VPS（Linux）**
```bash
git clone <your-repo> && cd scope3-investment
# 設定環境變數（不要放 .env 進 Git；或用 host 的 secret manager）
export NVIDIA_API_KEY=your_key
export NVIDIA_API_KEY_GEMMA=your_key
node server.js &   # 建議用 pm2 / systemd 常駐
```

### 部署後檢查

```bash
curl https://你的網址/api/health
# 應回傳 JSON： {"ok":true,"models":[...]}  ← 若回傳 HTML，代表主機沒跑 server.js
```

## 技術棧

- `index.html` — 純 HTML/CSS/JS，無框架依賴
- `server.js` — Node.js HTTP 伺服器 + NVIDIA NIM Chat Completions API（**零依賴**，使用 Node 內建 `fetch` 呼叫 `integrate.api.nvidia.com/v1`）
- 依賴：**無**（已移除 `openai` / `dotenv`）

## 安全提示

- API 金鑰只放在伺服器端環境變數或 `.env` 檔案（本機），**切勿**寫入前端或提交 Git。
- 雲端部署時，金鑰透過主機的「環境變數」設定，不要上傳 `.env` 檔案。
- 本倉庫的 `.env` 為方便本地測試而保留，正式部署請改用你自己的金鑰（聊天中貼出的 `nvapi-xecsp…` 金鑰建議在 NVIDIA 控制台輪換）。
