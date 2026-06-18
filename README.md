# 1001 Jazz｜一千零一首爵士乐入门地图

> 按年代、流派、人物、唱片与封面进入爵士乐史。一个**爵士乐策展网站**，不是播放器。

从新奥尔良到伦敦，从 78 转唱片到流媒体——这是一座**可听、可看、可读**的爵士乐地图。每首歌旁边，是一段告诉你「它为什么重要、应该听什么、听到哪里会发生变化」的中文导读。

## 特点

- **13 个历史时期**：Ragtime → New Orleans → Swing → Bebop → Cool → Hard Bop → Modal → Free → Latin → Fusion → Neo-bop → Acid/Nu/Smooth → New London/Global。
- **77 首样板曲库**（MVP）：每首含曲名、艺术家、作曲、年代、专辑、唱片公司、乐器标签、所属流派与 150 字内中文导读。
- **多入口浏览**：按年代 / 流派 / 人物 / 心情 / 乐器，以及全库搜索。
- **首页模块**：年代时间轴、今日一首、封面瀑布流、多种进入方式。

## 合法性原则

本站**不上传、不缓存、不下载、不托管任何音乐文件**：

- 「试听」按钮一律跳转到 Spotify / Apple Music / YouTube / Bandcamp 的**搜索页**，由各平台合法播放。
- 唱片封面为**程序化生成的视觉占位**（CSS 渐变 + 排版），非原版封面图片，避免版权与抓取问题。
- 内容为入门导读，仅供学习交流。

## 技术方案

纯静态单页网站，零构建、零依赖：

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面骨架、导航、页脚 |
| `styles.css` | 暗色复古爵士视觉 |
| `app.js` | hash 路由、渲染、搜索、封面生成 |
| `data.js` | 77 首曲库数据（`window.SONGS` / `window.ERAS`） |

## 本地运行

直接用浏览器打开 `index.html` 即可；或起一个本地静态服务器：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 部署

可一键部署到 GitHub Pages / Vercel / Cloudflare Pages（纯静态，根目录即网站）。
GitHub Pages：仓库 Settings → Pages → Source 选 `main` 分支根目录。

## 路线图

- [ ] 从 77 首样板扩充到 1001 首（13 时期 × 11 主题 × 7 首）
- [ ] 接入 MusicBrainz Cover Art Archive 真实封面
- [ ] 数据迁移至 CSV/JSON 或 Supabase
- [ ] Pagefind / Meilisearch 全文搜索
- [ ] 艺术家小传与专辑页

---

1001 系列 · 聆听地图
