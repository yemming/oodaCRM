# 專案開發規範書 (Project Specification)

兄弟，歡迎來到這個 React x NetSuite 的混血專案。這裡不是普通的網頁開發，我們是在 NetSuite 的限制下跳舞，所以請務必詳讀這份規範，以免你在部署的時候發現程式碼根本沒更新，然後懷疑人生。

## 1. 核心架構 (The Architecture)

這個專案是一個 **"偽" 前後端分離** 的架構。我們在本地享受 Vite 的極速開發體驗，但最終是寄生在 NetSuite 的 Suitelet 上生存。

### 角色分配
-   **Frontend (前端):** React + Vite + TypeScript. (位於 `src/`)
    -   負責 UI/UX，所有的互動邏輯。
    -   **產出:** 一個巨大的 `index.html` (包含所有 JS/CSS)。
-   **Backend (後端):** NetSuite Suitelet. (位於 `netsuite/`)
    -   負責資料存取 (SuiteScript / SuiteQL)。
    -   **產出:** 一個 API Endpoint，同時也是 HTML 的宿主 (Host)。

### 運作原理
1.  使用者存取 Suitelet URL。
2.  Suitelet 讀取 File Cabinet 裡的 `index.html` 內容，並直接輸出給瀏覽器 (String output)。
3.  React App 在瀏覽器啟動，變成 Single Page Application (SPA)。
4.  React App 透過 `fetch` 呼叫同一個 Suitelet URL (帶上 `action` 參數) 來獲取資料。

---

## 2. 開發流程 (The Workflow)

兄弟，這點最重要。因為我們是 "本地編譯，雲端執行"，所以**不要直接去改 `deploy/` 資料夾裡的東西**。那裡只是暫存區 (Staging Area)，下次編譯就會被覆蓋掉。

### ✅ 正確的開發姿勢

#### A. 本地開發 (Local Development)
```bash
npm run dev
```
-   啟動 Vite Server。
-   你可以看到 UI，但資料是 Mock Data (因為連不到 NetSuite)。
-   適合：調版型、寫 UI 邏輯、測試互動。

#### B. 部署上線 (Deploy to NetSuite)

這是大家最容易搞錯的地方。記住口訣：**"先 Build，再 Copy，最後 Deploy"**。

為了方便兄弟，我已經幫你寫好了一鍵準備指令：

1.  **準備部署檔案 (Build & Stage):**
    ```bash
    npm run deploy:prepare
    ```
    -   這個指令會自動做以下事情：
        1.  `vite build`: 把 React 程式碼打包成一個 `index.html` (在 `dist/`)。
        2.  `cp`: 把 `dist/index.html` 複製到 `deploy/.../Kanban_POC/`。
        3.  `cp`: 把 `netsuite/Kanban_Suitelet.js` 複製到 `deploy/.../Kanban_POC/`。
    -   **警告:** 如果你沒跑這行，你部署上去的永遠是舊的程式碼！

2.  **上傳到 NetSuite (Push):**
    ```bash
    cd deploy
    suitecloud project:deploy
    ```
    -   這會把 `deploy/` 資料夾裡的內容推送到 NetSuite File Cabinet。

---

## 3. 檔案結構 (File Structure)

```
oodaCRM/
├── src/                # [前端源碼] React 都在這，盡情揮灑
├── netsuite/           # [後端源碼] Suitelet 邏輯在這 (Source of Truth)
├── dist/               # [編譯產出] Vite 產生或是暫存的地方，不要手動改
├── deploy/             # [部署暫存] SuiteCloud CLI 認得的目錄
│   └── FileCabinet/
│       └── SuiteScripts/
│           └── Kanban_POC/
│               ├── index.html          # (由 deploy:prepare 自動生成)
│               └── Kanban_Suitelet.js  # (由 deploy:prepare 自動生成)
└── package.json        # 腳本都在這
```

## 4. 專案守則 (Project Rules)

1.  **不要手動改 `deploy/` 裡的檔案**：那是給機器看的，不是給人看的。改了下次 Build 就沒了。
2.  **`Kanban_Suitelet.js` 雙邊同步**：主要改 `netsuite/` 下的那支。`deploy:prepare` 會幫你同步過去。
3.  **Vite Single File**：我們用了 `vite-plugin-singlefile` 把所有 CSS/JS 塞進一個 HTML。這是為了避開 NetSuite 對外部資源引用的龜毛限制。

兄弟，跟著這個規範走，你的開發體驗會像絲般順滑。去寫 Code 吧！ 🚀
