<!-- filepath: c:\junxiang\Cent\README.md -->
# Cent

繁體中文 | [English](./README_EN.md)

> 你可能只需要一個記帳軟體。

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-green.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-supported-blue.svg)]()
[![GitHub Repo](https://img.shields.io/badge/data-storage_on_GitHub-black?logo=github)]()

Cent 是一個 **完全免費、開源的多人協作記帳 Web App**，
基於 **GitHub 倉庫** 實現資料同步與版本控制，無需伺服器，即可實現跨平台即時同步。

🔗 **線上體驗**：[https://cent.linkai.work](https://cent.linkai.work)
💾 **開源倉庫**：[https://github.com/glink25/Cent](https://github.com/glink25/Cent)
📖 **部落格**：[https://glink25.github.io/tag/Cent/](https://glink25.github.io/tag/Cent/)

> [Cent 1.0 正式發佈 🎉](https://glink25.github.io/edit/?path=Cent-10-%E6%AD%A3%E5%BC%8F%E5%8F%91%E5%B8%83-)

---

## 📈 功能預覽

| 功能 | 截圖 |
|------|------|
| 二級分類 & 標籤管理 | ![分類示例](https://glink25.github.io/post-assets/mgucw881-cent-accountting.jpg) |
| 自訂標籤系統 | ![標籤示例](https://glink25.github.io/post-assets/mgucw884-cent-tag-1.jpg) |
| 統計與分析視圖 | ![統計分析](https://glink25.github.io/post-assets/mgucw884-cent-stat.jpg) |
| 預算管理 | ![預算視圖](https://glink25.github.io/post-assets/mgucw884-cent-budget.jpg) |
| GitHub 協作 | ![協作功能](https://glink25.github.io/post-assets/mgucw884-github-collaborator.jpg) |

>  **最新更新**：Cent 現已支援 AI 助手、語音記帳、多幣種管理、地圖視覺化、週期記帳等眾多新功能！詳見 [Cent 1.1 更新說明](https://glink25.github.io/post/Cent-%E5%B7%B2%E6%94%AF%E6%8C%81%E5%A4%9A%E5%B8%81%E7%A7%8D%E8%87%AA%E5%8A%A8%E8%AE%B0%E8%B4%A6/)。

---

## ✨ 特性

### 💾 資料完全自持
帳本資料保存在你的 GitHub/Gitee 私人倉庫或 Web DAV 中，無需任何第三方伺服器。透過 **GitHub Collaborator** 功能即可實現多人協作，**增量同步**機制只上傳/下載變更資料，大幅縮短同步時間。

### 🤖 AI 智慧體驗
長按記帳按鈕即可**語音記帳**，AI 自動解析金額、分類和備註。設定 OpenAI 相容 API 後，可進行帳單分析、預算建議、年度總結等智慧對話，還能根據歷史資料**智慧預測**分類。

### 💱 多幣種 & 週期記帳
支援 30+ 種國際貨幣及自訂幣種，即時匯率自動轉換，適合出國旅行和跨境消費。為訂閱服務、自動續費等建立**週期記帳**範本，自動產生帳單。

### 📊 統計分析 & 視覺化
多維度篩選與趨勢分析、自訂分析視圖、預算管理與進度監控。在**地圖上查看消費足跡**，支援高德地圖。

### 🛠️ 更多功能
- 📱 **PWA 支援**：可安裝到桌面，像原生 App 一樣使用
- 📥 **智慧匯入**：支援微信/支付寶帳單，可用 AI 建立自訂匯入方案
- 🏷️ **二級分類 & 標籤**：自訂分類、標籤分組、單選/多選、偏好幣種
- 📋 **快捷操作**：iOS 捷徑指令、剪貼簿記帳、批次編輯、自然語言辨識
- 🎨 **個人化**：深色模式、自訂 CSS、鍵盤客製化

*...以及更多功能等你探索 ✨*

## 🧠 核心原理

Cent 是一個「純前端」的 PWA 應用。
除 GitHub/Gitee OAuth 登入外，Cent 不依賴任何後端服務。

了解詳情：[現在開始將 Github 作為資料庫](https://glink25.github.io/post/%E7%8E%B0%E5%9C%A8%E5%BC%80%E5%A7%8B%E5%B0%86Github%E4%BD%9C%E4%B8%BA%E6%95%B0%E6%8D%AE%E5%BA%93/)

### 🗂 資料結構

- 每個帳本（Book）即為一個 GitHub/Gitee 倉庫。
- 資料以 JSON 格式儲存在倉庫中，支援歷史版本回滾。
- 透過倉庫名識別帳本，實現多帳本管理。

### 🔁 增量同步機制

Cent 內建一套自訂的增量同步策略，僅同步增量差異：
- 首次同步：完整下載資料。
- 後續同步：僅傳輸新增或修改部分。
- 支援離線快取與斷點續傳。

該機制顯著提升了同步效率，使得多人協作體驗流暢自然。

### 🧩 可擴展同步端點

同步邏輯經過抽象封裝，未來將支援：
- 自建伺服器
- 網路硬碟（如 Dropbox、OneDrive）
- 本地離線帳本

---


## 🚀 部署與使用

### 方式一：直接使用線上版本

1. 開啟 [https://cent.linkai.work](https://cent.linkai.work)
2. 使用 GitHub 登入授權
3. 新建帳本（將自動建立一個倉庫）
4. 開始記帳 🎉

### 方式二：透過 GitHub Pages 自行部署

1. Fork 本倉庫
2. 進入倉庫的 **Settings → Pages**，將 Source 設定為 `GitHub Actions` 或指定分支（例如 `gh-pages`）
3. 設定建置指令（可透過 GitHub Actions 自動執行 `pnpm build`，將產出部署至 GitHub Pages）
4. 部署完成後，即可透過 `https://<你的使用者名稱>.github.io/Cent/` 存取
5. 在登入頁面手動輸入 GitHub Token 使用
6. 所有帳本與資料均儲存於你的 GitHub 倉庫中

> 出於安全考量，自行部署方式無法支援 Github/Gitee 一鍵登入，需要自行在 Github/Gitee 設定頁面產生具有 Repo 讀寫權限的 token，透過手動輸入 token 功能使用。
> Cent 使用 Cloudflare Workers 部署了一個線上驗證服務，該服務只針對受信任的網域提供服務。如果需要快捷登入服務，可以參考 [cent-github-backend](https://github.com/glink25/cent-github-backend) 專案建立自己的後端服務，並自行申請對應平台的 OAuth App。

---

## 🧪 開發計畫

### 已完成
- ✅ 增量同步核心實作
- ✅ 多人協作帳本
- ✅ AI 助手功能
- ✅ 語音記帳
- ✅ 多幣種支援與匯率管理
- ✅ 地圖支出視覺化（高德地圖整合）
- ✅ 週期記帳
- ✅ 智慧匯入（支付寶/微信帳單）
- ✅ 標籤系統升級
- ✅ Web DAV 同步支援
- ✅ 捷徑指令整合
- ✅ 批次編輯功能

### 進行中
- 🚧 自動測試體系
- 🚧 更多同步端點（Dropbox / OneDrive）

### 計畫中
- 📋 資料報表匯出（PDF/Excel）
- 📋 更多智慧功能

---

## 💬 貢獻與回饋

Cent 歡迎所有開發者與使用者參與貢獻，提交程式碼前請參考[貢獻指南](docs/contributing/zh.md)：

> QQ 交流群：861180883

```bash
# 克隆專案
git clone https://github.com/glink25/Cent.git

# 安裝依賴
pnpm install

# 本地執行
pnpm dev

# 格式校驗
pnpm lint
```

## 📜 授權條款

本專案採用 Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) 授權。
 - 允許共享、改編與再發佈
 - 必須署名原作者
 - 禁止商業使用
 - 衍生作品須使用相同授權條款

 ---


## ☕️ Buy Me a Coffee

感謝您對本專案的支持！Cent 目前僅由單人支持開發，您的捐款將用於維護和持續開發。

<details>
<summary>點擊查看</summary>

### 💰 支付寶 (Alipay)


<img src="https://glink25.github.io/post-assets/sponsor-solana.jpg" width="50%" alt="支付寶收款碼">

---

### 🌐 Solana (SOL)

**錢包地址：**

`vEzM9jmxChx2AoMMDpHARHZcUjmUCHdBShwF9eJYGEg`

**QR Code：**

<img src="https://glink25.github.io/post-assets/sponsor-alipay.jpg" width="50%" alt="solana">

---
</details>


---

## 🙏 感謝牆 / Donor Wall

感謝所有支持 Cent 專案的捐贈者！您的支持是我持續開發的動力。
Thank you to all donors who support the Cent project! Your support is the driving force behind my continued development.

<div align="center">

<table>
<tr>
<td align="center">
  <a href="">
    <img src="https://api.dicebear.com/7.x/initials/svg?seed=一" width="60" height="60" alt="" style="border-radius: 50%;"/>
    <br />
    <sub><b>一**戶</b></sub>
  </a>
</td>
</tr>
</table>

</div>

---
