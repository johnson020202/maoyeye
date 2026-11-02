# maoyeye

一个极简的安卓应用：每次打开随机显示一段《毛泽东选集》原文，配篇名、日期和毛选编者注；左滑下一条，右滑回到上一条。支持应用内热更新，内容更新不需要重新安装 APK。

## 下载安装

- 最新 APK：[Releases](https://github.com/johnson020202/maoyeye/releases/latest) → **`maoyeye.apk`**
- Android 7.0（API 24）及以上，约 2.5 MB。
- 使用固定发布密钥签名，后续版本可直接覆盖升级。

## 内容与去重

- 语料来自开源全文仓库 [weiyinfu/MaoZeDongAnthology](https://github.com/weiyinfu/MaoZeDongAnthology)（229 篇，约 123 万字）。
- 按“段落 + 句子”两级抽取并去重，得到 **18,506 条**互不相同的原文卡片，覆盖 225 个篇目。
- 首屏采用**洗牌抽牌**：一副牌抽完之前绝不重复，因此连续 **10,000 次以上不重样**；抽满 18,506 次后才重新洗牌，且新一轮第一张不会与上一张相同。
- 当前版本的“解读”使用《毛泽东选集》各篇的**官方编者注**（写作背景、发表情况），不是 AI 生成文字。

## 交互

- 打开即随机抽一张，历史记录保存在本地（localStorage），下次打开仍是新的一张。
- **左滑** = 下一条（历史末尾则抽新牌），**右滑** = 上一条；底部另有“上一条 / 下一条”按钮。
- 手势使用 touch 事件并在判定横向意图后 `preventDefault()`，避免被 WebView 的滚动接管；拖动时卡片跟手位移，松手超过阈值或速度足够即翻页。
- 桌面预览可用方向键 ← →。

## 视觉

- 字体：开源字体 **得意黑（Smiley Sans）**，SIL OFL 1.1，许可证见 `LICENSES/SmileySans-OFL.txt`。
- 头像：红底五角星矢量肖像，本地打包，不联网。
- 全面屏适配：Activity 用 `FrameLayout` 容器承载系统栏 inset（并以 `status_bar_height` / `navigation_bar_height` 兜底），避免 Android 15+ 强制边到边时标题被状态栏遮住。

## 热更新

应用启动时会在后台依次请求以下地址的 `version.json`：

1. `https://cdn.jsdelivr.net/gh/johnson020202/maoyeye@main/update/version.json`
2. `https://raw.githubusercontent.com/johnson020202/maoyeye/main/update/version.json`

若远端 `version` 大于当前版本，则下载同目录下的 `web.zip`，校验 `sha256`、解压到应用私有目录并切换加载；失败时静默回退到 APK 内置资源，不影响离线使用。页面右上角会显示当前内容版本（如 `· v5`），更新成功会弹出提示。

发布一次热更新：

```bash
# 1. 修改 assets 下的 H5 文件
# 2. 重新打包（包含字体）
cd app/src/main/assets
zip -r ../../../update/web.zip index.html style.css app.js deck.js cards.js avatar.jpg smiley-sans.woff2 version.json
# 3. 计算 sha256，写进 update/version.json（version 递增）
```

## 从源码构建

仓库自带 GitHub Actions（`.github/workflows/build.yml`）：push 到 `main` 后自动构建 **release APK**，用仓库 Secrets 里的固定密钥对齐并签名，产物为 `maoyeye.apk`，随后发布到 Releases。

本地构建需要 JDK 17 与 Android SDK 35：

```bash
gradle assembleRelease
```

签名需要自己的 keystore；未配置签名时构建产物是 `app-release-unsigned.apk`。

## 目录

```
app/src/main/assets/    H5 页面（index.html / style.css / app.js / deck.js / cards.js / avatar.jpg / smiley-sans.woff2）
app/src/main/java/      WebView 壳（MainActivity.java / HotUpdater.java）
update/                 热更新清单与更新包
tools/                  语料抽取、抽卡测试、界面触摸测试、API 推送脚本
LICENSES/               得意黑字体许可证
```

## 测试

```bash
node tools/test-deck.cjs   # 抽卡引擎：12000 次连续抽取无重复
node tools/test-ui.mjs     # 无头浏览器：触摸滑动 / 按钮 / 竖向不误触 / 字体与头像加载 / 横向溢出
```

## 版权说明

《毛泽东选集》文本与编者注的著作权归原出版方；本仓库仅作个人学习与测试用途，公开分发前请自行确认授权。头像为本地打包的矢量肖像，仅作个人使用。

## License

代码部分 MIT；得意黑字体遵循 SIL OFL 1.1。
