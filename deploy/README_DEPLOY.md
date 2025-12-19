# NetSuite 部署說明 (一鍵部署)

兄弟，我已經幫你把所有的 React 編譯產物和 SuiteScript 準備好了。

## 📍 部署目錄
`/Users/mingyou/Documents/cursor/oodaCRM/deploy`

## 🚀 部署指令
請在 Terminal 執行以下指令：

```bash
cd /Users/mingyou/Documents/cursor/oodaCRM/deploy

# 1. 重新授權帳號 (因為 luxgen_sandbox 過期了)
suitecloud account:setup --authid luxgen_sandbox

# 2. 執行部署
suitecloud project:deploy --validate
```

## 📂 部署內容
- **React App**: `/FileCabinet/SuiteScripts/Kanban_POC/dist/index.html`
- **Suitelet**: `/FileCabinet/SuiteScripts/Kanban_POC/Kanban_Suitelet.js`

## 🎯 部署後工作
1. 在 NetSuite 建立 **Suitelet Script Record**。
2. 腳本檔案指向 `/SuiteScripts/Kanban_POC/Kanban_Suitelet.js`。
3. 建立 **Deployment** 並取得 **URL**。
4. 打開網頁，見證你的 Kanban Dashboard 降臨！
