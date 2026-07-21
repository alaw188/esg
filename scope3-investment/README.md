# 範圍三碳排放計算平台

計算 **GHG Protocol 範圍三第 15 分類（投資）** 碳排放，支援任意香港及美國上市公司。排放數據由 AI 模型（預設 **NVIDIA MiniMax M3**，可切換至 **Groq Llama 3.1 8B Instant**）根據其訓練知識，從公司公開可持續發展報告估算。

## 架構

**一個倉庫，一次推送，一個網址，直接使用。**

本專案支援兩種部署方式，二選一即可：

| 方式 | 平台 | 需要申請？ | 難度 |
|------|------|-----------|------|
| **A — Cloudflare Pages（推薦）** | Cloudflare（免費） | 註冊 Cloudflare 帳號 | 簡單 |
| **B — Node 伺服器** | Render / Railway（免費） | 註冊 Render 帳號 | 簡單 |

> **為什麼 GitHub Pages 不夠？** NVIDIA、Groq 的 API **沒有 CORS 標頭**，瀏覽器會擋下呼叫。必須有伺服器端轉發請求。Cloudflare Pages 內建伺服器函數，可以從同一個域名提供 API，沒有 CORS 問題。

---

# 部署方式 A：Cloudflare Pages（最推薦，從 GitHub 自動部署）

## 第一步：建立 Cloudflare 帳號

1. 前往 [dash.cloudflare.com](https://dash.cloudflare.com) → **Sign up**（用 Google 或 email 註冊，免費）
2. 驗證 email 後登入控制台

## 第二步：連接 GitHub 並部署

1. 在 Cloudflare 控制台，左側選 **Workers & Pages**
2. 點 **Create** → **Pages** → **Connect to Git**
3. 點 **Connect GitHub** → 授權 Cloudflare 讀取你的倉庫
4. 選擇你的倉庫 → **Begin setup**
5. 無需任何設定 → 直接點 **Deploy**
6. 等待約 1 分鐘，Cloudflare 會給你一個網址：
   ```
   https://你的專案名稱.pages.dev
   ```
7. **打開這個網址即可使用**

> 每次你推送到 GitHub，Cloudflare 會自動重新部署。

### 你的專案檔案結構

```
你的倉庫/
├── index.html              ← 前端計算器（自動提供）
├── functions/
│   ├── _lib.js             ← 共享邏輯（模型註冊 + 輔助函數）
│   └── api/
│       ├── health.js       ← /api/health
│       └── emissions.js    ← /api/emissions
├── server.js               ← 也可用 Render 部署（見方式 B）
├── package.json
└── README.md
```

Cloudflare Pages 會自動：
- 把 `index.html` 當作靜態網站提供
- 把 `functions/api/` 底下的檔案當作 API 端點，網址為 `/api/health` 和 `/api/emissions`
- 一切都是同一個域名，CORS 問題不存在

---

# 部署方式 B：Render / Railway（Node 伺服器）

1. 註冊 [Render](https://render.com)（免費）→ 連接 GitHub
2. New + → **Web Service** → 選你的倉庫
3. **Start Command**: `node server.js`
4. Create → 等 2 分鐘 → 打開 Render 給你的網址

---

## 功能

- 輸入**任意**美國（`AAPL`）或香港（`0012`、`0700.HK`）股票代號
- AI 自動辨識公司並估算其最新範圍一、二排放（預設 NVIDIA MiniMax M3，可在「AI 模型」下拉選單切換至 Groq）
- 投資組合表格：新增、修改持股、重新查詢、移除
- **手動輸入後備**：若 AI 未能辨識某股票，可直接手動填入排放數據繼續計算
- 按 PCAF 標準計算範圍三融資排放
- 點擊「**匯出 PDF 報告**」產生供審計追溯的完整報告
- 快取 24 小時，減少 API 調用

## 切換 AI 模型

工具列的「AI 模型」下拉選單可切換：
- **NVIDIA MiniMax M3**（預設）— 約 10–30 秒
- **Groq Llama 3.1 8B Instant** — 較快，但目前 Groq 金鑰待更新

## 免責

本平台排放數據由 AI 根據公開報告估算，僅供內部估算參考，不作為合規披露依據。正式用途請以 CDP、Bloomberg、Moody's 等權威 ESG 數據庫核實。

## API

```
GET /api/health                              # 檢查可用模型
GET /api/emissions?ticker=AAPL               # 查詢（預設模型 minimax）
GET /api/emissions?ticker=0012               # 香港代號
GET /api/emissions?ticker=AAPL&model=groq    # 指定模型
GET /api/emissions?ticker=AAPL&model=minimax
```

## 安全提示

API 金鑰寫在 `functions/_lib.js` 和 `server.js` 中並提交進 Git（依專案需求）。若倉庫公開，金鑰等同公開。建議改用 Cloudflare Pages 的 **環境變數**（Settings → Environment Variables → add `NVIDIA_API_KEY`、`GROQ_API_KEY`），並將程式碼中的 `apiKey` 改為讀取 `env.NVIDIA_API_KEY` / `env.GROQ_API_KEY`。

## 開發：本機測試

```bash
node server.js
# 打開 http://localhost:3000
```
