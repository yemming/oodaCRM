---
name: NetSuite React Application
description: 建立在 NetSuite 平台上以 React + Vite 開發的 SPA 應用程式架構
---

# NetSuite React Application Skill

當用戶要求建立一個 NetSuite SPA 應用程式時，請遵循以下架構與模式生成專案檔案。

---

## 架構概述

這是一個「偽」前後端分離架構：
- **前端**：React + Vite + TypeScript，編譯成單一 HTML 檔案
- **後端**：NetSuite Suitelet (SuiteScript 2.1)，同時作為 API 端點和 HTML 宿主

**運作流程**：
1. 使用者存取 Suitelet URL
2. Suitelet 載入 File Cabinet 中的 `index.html`，注入資料後輸出
3. React SPA 啟動，透過 fetch 呼叫同一 Suitelet URL（帶 `action` 參數）存取 API

---

## 專案目錄結構

生成新專案時，請建立以下結構：

```
{PROJECT_NAME}/
├── src/
│   ├── App.tsx              # 主應用程式
│   ├── App.css              # 全域樣式
│   ├── main.tsx             # React 掛載點
│   ├── index.css            # Tailwind CSS 入口
│   ├── components/          # React 元件
│   └── services/
│       └── api.ts           # NetSuite API 整合層
├── netsuite/
│   └── {PROJECT_NAME}_Suitelet.js  # Suitelet 後端
├── deploy/
│   ├── FileCabinet/SuiteScripts/{PROJECT_NAME}/
│   ├── Objects/             # SDF 物件定義
│   ├── manifest.xml
│   ├── deploy.xml
│   └── project.json
├── scripts/
│   └── build_suitelet.js    # 建構腳本
├── vite.config.ts
├── package.json
├── tsconfig.json
└── PROJECT_SPEC.md
```

---

## 技術堆疊

| 類別 | 技術 |
|------|------|
| 前端框架 | React 19+ with Hooks |
| 前端建構 | Vite 7+ |
| 型別系統 | TypeScript 5+ |
| CSS 框架 | Tailwind CSS 4+ |
| 打包策略 | vite-plugin-singlefile（單一 HTML） |
| 後端平台 | NetSuite Suitelet (SuiteScript 2.1) |
| 部署工具 | SuiteCloud CLI (SDF) |

---

## 核心檔案模板

### vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

### package.json 腳本
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "deploy:prepare": "tsc -b && vite build && node scripts/build_suitelet.js && cp dist/{PROJECT_NAME}_Suitelet_App.js deploy/FileCabinet/SuiteScripts/{PROJECT_NAME}/"
  }
}
```

---

## 前端 API 服務層模式 (api.ts)

```typescript
// 環境檢測
const isNetSuite = typeof window !== 'undefined' && window.NETSUITE_CONTEXT;

// 全域型別
declare global {
  interface Window {
    NETSUITE_CONTEXT?: {
      suiteletUrl: string;
      userId: string;
      userName: string;
    };
    NETSUITE_DATA?: {
      // 根據專案需求定義資料結構
    };
  }
}

// 取得資料（優先使用伺服器注入資料）
export async function fetchData(): Promise<DataType[]> {
  if (isNetSuite && window.NETSUITE_DATA) {
    return window.NETSUITE_DATA.items;
  }
  return DEMO_DATA; // 本地開發用
}

// API 呼叫（使用 GET 避免 CSRF）
export async function callApi(action: string, params: Record<string, string>): Promise<any> {
  if (!isNetSuite) return { success: true }; // 本地模擬
  
  const url = new URL(window.NETSUITE_CONTEXT!.suiteletUrl);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const response = await fetch(url.toString());
  return response.json();
}
```

---

## 後端 Suitelet 模式

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/file', 'N/runtime', 'N/record', 'N/query', 'N/url'],
    (file, runtime, record, query, url) => {

        const PROJECT_NAME = '{PROJECT_NAME}';
        const HTML_PATH = `/SuiteScripts/${PROJECT_NAME}/index.html`;

        function onRequest(context) {
            const action = context.request.parameters.action;
            if (action) {
                handleApiRequest(context, action);
            } else {
                handleUIRequest(context);
            }
        }

        function handleUIRequest(context) {
            const htmlFile = file.load({ path: HTML_PATH });
            let html = htmlFile.getContents();

            // 注入上下文與資料
            const injection = `<script>
                window.NETSUITE_CONTEXT = ${JSON.stringify({
                    suiteletUrl: url.resolveScript({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId
                    }),
                    userId: runtime.getCurrentUser().id,
                    userName: runtime.getCurrentUser().name
                })};
                window.NETSUITE_DATA = ${JSON.stringify(getData())};
            </script>`;

            html = html.replace('</head>', injection + '</head>');
            context.response.write(html);
        }

        function handleApiRequest(context, action) {
            let result;
            switch (action) {
                case 'getData': result = getData(); break;
                case 'saveRecord': result = saveRecord(context.request.parameters); break;
                // 根據需求新增 action
            }
            context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            context.response.write(JSON.stringify(result));
        }

        function getData() {
            // 使用 SuiteQL 查詢資料
            const sql = `SELECT id, name FROM customrecord_xxx WHERE isinactive = 'F'`;
            return query.runSuiteQL({ query: sql }).asMappedResults();
        }

        return { onRequest };
    });
```

---

## SDF 物件定義

### Suitelet 部署設定 (customscript_{project_name}.xml)
```xml
<suitelet scriptid="customscript_{project_name}">
    <name>{Project Display Name}</name>
    <scriptfile>[/SuiteScripts/{PROJECT_NAME}/{PROJECT_NAME}_Suitelet.js]</scriptfile>
    <scriptdeployments>
        <scriptdeployment scriptid="customdeploy_{project_name}">
            <title>{Project Display Name}</title>
            <status>RELEASED</status>
            <loglevel>DEBUG</loglevel>
        </scriptdeployment>
    </scriptdeployments>
</suitelet>
```

### Custom Record 範例 (customrecord_{record_name}.xml)
```xml
<customrecord scriptid="customrecord_{record_name}">
    <recordname>{Record Display Name}</recordname>
    <customrecordcustomfields>
        <customrecordcustomfield scriptid="custrecord_{field_name}">
            <fieldtype>TEXT</fieldtype>
            <label>{Field Label}</label>
        </customrecordcustomfield>
    </customrecordcustomfields>
</customrecord>
```

---

## 開發守則

1. **`deploy/` 是自動生成的** - 不要手動修改，會被覆蓋
2. **Suitelet 源碼在 `netsuite/`** - 這是 Source of Truth
3. **API 使用 GET 請求** - 避免 NetSuite CSRF 問題
4. **本地用 Mock Data** - `api.ts` 中準備 DEMO_DATA
5. **使用路徑載入 HTML** - `file.load({ path: ... })`，不用 ID

---

## 生成新專案時

當用戶說「用 NetSuite React App Skill 建立 XXX 專案」時：

1. 確認專案名稱和主要功能需求
2. 根據上述結構生成所有必要檔案
3. 將 `{PROJECT_NAME}` 替換為實際專案名稱
4. 根據功能需求設計資料結構和 API actions
5. 生成對應的 Custom Records 和 Suitelet 邏輯

---

## 部署指令

```bash
# 準備部署檔案
npm run deploy:prepare

# 部署到 NetSuite
cd deploy
suitecloud project:deploy
```
