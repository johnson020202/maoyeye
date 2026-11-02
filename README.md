# 毛选语录（maoyeye）

一个极简的安卓 App：每次打开随机显示一段《毛泽东选集》原文，配篇名、日期和毛选编者注；左滑看下一条，右滑回看上一条。完全离线，无网络权限。

## 下载安装

- 最新 APK：[Releases](https://github.com/johnson020202/maoyeye/releases/latest) → `app-debug.apk`
- Android 5.0（API 21）及以上，约 1.5 MB。

## 内容与去重

- 语料来自开源全文仓库 [weiyinfu/MaoZeDongAnthology](https://github.com/weiyinfu/MaoZeDongAnthology)（229 篇，约 123 万字）。
- 按“段落 + 句子”两级抽取并去重，得到 **18,506 条**互不相同的原文卡片，覆盖 225 个篇目。
- 首页采用**洗牌抽牌**：一副牌抽完之前绝不重复，因此连续 **10,000 次以上不重样**；抽满 18,506 次后才重新洗牌，且新一轮第一张不会与上一张相同。
- 当前版本的“解读”使用《毛泽东选集》各篇的**官方编者注**（写作背景、发表情况），不是 AI 生成文字。后续版本会补人工撰写的现实启示。

## 交互

- 打开即随机抽一张，历史记录保存在本地（localStorage），下次打开仍是新的一张。
- 左滑 = 下一条（历史里没有就抽新牌），右滑 = 上一条。
- 桌面预览可用方向键 ← →。

## 从源码构建

仓库自带 GitHub Actions（`.github/workflows/build.yml`）：push 到 `main` 后自动用 JDK 17 + Gradle 8.7 构建 debug APK，并发布到 Releases。

本地构建需要 JDK 17 与 Android SDK：

```bash
gradle assembleDebug
```

产物：`app/build/outputs/apk/debug/app-debug.apk`。

## 目录

```
app/src/main/assets/    H5 页面（index.html / style.css / app.js / deck.js / cards.js / avatar.jpg）
app/src/main/java/      WebView 壳（MainActivity.java）
tools/                  语料抽取脚本（extract_cards.mjs / extract_sent.mjs）
```

## 数据再生成

```bash
# 1. 取得全文
git clone https://github.com/weiyinfu/MaoZeDongAnthology.git
# 2. 抽取（脚本内 SRC 指向 …/src 目录）
node tools/extract_cards.mjs
node tools/extract_sent.mjs
# 3. 合并、去重、生成 assets/cards.js
```

## 版权说明

《毛泽东选集》文本与编者注的著作权归原出版方；本仓库仅作个人学习与测试用途，公开分发前请自行确认授权。头像取自用户提供的参考图，仅本地打包，不联网。

## License

代码部分 MIT。
