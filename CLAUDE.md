# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案本質

這是一個 **React + Vite + TypeScript SPA，寄生在 NetSuite Suitelet 上運行**的 CRM 看板工具。本地享受 Vite 的極速開發體驗，但最終產出是一個注入了 HTML 的 NetSuite Suitelet JS 檔案。沒有獨立的伺服器；NetSuite Suitelet 同時扮演 API endpoint 和 HTML 宿主。

## 常用指令

```bash
# 本地開發（Mock 資料模式，UI/互動測試用）
npm run dev

# TypeScript 型別檢查 + Vite 打包
npm run build

# Lint
npm run lint

# 完整部署準備（build → 注入 HTML 到 Suitelet → 複製到 deploy/）
npm run deploy:prepare

# 推送到 NetSuite（在 deploy/ 目錄下執行）
cd deploy && suitecloud project:deploy
```

**無測試框架**。目前沒有 Vitest / Jest，驗證功能需靠瀏覽器或手動測試。

## 核心架構

### 建置流程（關鍵！）

`deploy:prepare` 做了以下事：

1. `tsc -b && vite build` → 產生 `dist/index.html`（含所有 CSS/JS，單一檔案）
2. `scripts/build_suitelet.js` → 讀取 `dist/index.html`，將 HTML 字串注入 `netsuite/*.js` 的 `// <!-- START HTML LOAD -->` 與 `// <!-- END HTML LOAD -->` 標記區間，輸出到 `dist/Kanban_Suitelet_App.js` 和 `dist/OCR_Page_Suitelet_App.js`
3. `cp` → 將上述產出複製到 `deploy/FileCabinet/SuiteScripts/Kanban_POC/`

**核心守則**：
- **不要手動修改 `deploy/` 裡的任何檔案**，下次 build 就被覆蓋
- Frontend 源碼在 `src/`；Suitelet 後端源碼在 `netsuite/`
- `vite-plugin-singlefile` 強制所有 CSS/JS 內聯進單一 HTML，繞過 NetSuite 對外部資源的限制

### 前後端通訊

React App 透過 `src/services/api.ts` 與後端溝通：
- 偵測 `window.NETSUITE_CONTEXT` 是否存在來判斷執行環境
- NetSuite 環境：`fetch` 打同一個 Suitelet URL + `action` 參數
- 本地開發：自動 fallback 到 Mock 資料
- 所有請求用 `credentials: 'include'` 帶 session

### 目錄職責

| 目錄/檔案 | 職責 |
|---|---|
| `src/` | React 前端源碼（唯一應手動修改的地方） |
| `src/components/` | React UI 元件 |
| `src/services/` | API 層：`api.ts`（NetSuite）、`n8nApi.ts`（AI）、`ocrService.ts`（OCR）|
| `netsuite/` | Suitelet 源碼（後端 Source of Truth） |
| `scripts/build_suitelet.js` | HTML 注入腳本 |
| `deploy/` | SuiteCloud CLI 部署暫存區（機器用，人不動） |
| `deploy/Objects/` | Custom Records / Scripts XML 定義 |
| `dist/` | Vite 建置產出（暫存，不 commit） |

### 主要應用模式

- **Kanban 模式**（主入口 `src/App.tsx`）：拖拉式機會看板，使用 dnd-kit
- **OODA 分析頁**（`src/components/OodaAnalysisPage.tsx`）：OODA 框架策略分析
- **OCR 名片**（`src/components/BusinessCardUploadModal.tsx`）：透過 `ocrService.ts` 上傳解析

### NetSuite 自訂物件

| 物件 | 用途 |
|---|---|
| `customrecord_ooda_analysis` | 儲存 OODA 分析結果 |
| `customrecord_ooda_pain_sheet` | 客戶痛點評估 |
| `customrecord_ooda_config` | 設定值 |
| `customlist_ooda_type` | 分析類型清單 |

Suitelet 後端以 action-based routing 處理所有 API 請求（updateStatus、saveAnalysis、getPainSheet 等）。

### 外部整合

- **N8N**（`src/services/n8nApi.ts`）：AI Coach、Email 模板生成、Pain 分析等 webhook
- **OCR Suitelet**：名片圖片 base64 上傳，提取聯絡資訊
