# 1001 Jazz｜一千零一张爵士必听专辑地图

> 按年代、流派、人物、唱片公司与封面进入爵士乐史。一个**爵士乐策展网站**，不是播放器。

从新奥尔良到伦敦，从 78 转唱片到流媒体——这是一座**可听、可看、可读**的爵士乐地图。每张专辑旁边，是一段告诉你「它为什么重要、应该从哪听起」的中文导读。

## 特点

- **13 个历史时期**：Ragtime → New Orleans → Swing → Bebop → Cool → Hard Bop → Modal → Free → Latin → Fusion → Neo-bop → Acid/Nu/Smooth → New London/Global。
- **1001 张必听专辑**：每张含专辑名、艺术家、发行年份、唱片公司、乐器标签、流派标签与中文导读。
- **多入口浏览**：按年代 / 流派 / 人物 / 心情 / 乐器，以及全库搜索。
- **真实专辑封面**：通过 iTunes Search 接口（`entity=album`）按需懒加载，失败时回退为程序化视觉占位。
- **首页模块**：年代时间轴、今日一张、封面瀑布流、多种进入方式。

## 合法性原则

本站**不上传、不缓存、不下载、不托管任何音乐文件**：

- 「试听」按钮一律跳转到 Spotify / Apple Music / YouTube / Bandcamp 的**搜索页**，由各平台合法播放。
- 专辑封面取自 iTunes 公共接口（客户端按需请求并本地缓存），加载失败时回退为程序化生成的视觉占位。
- 内容为入门导读，仅供学习交流。

## 技术方案

纯静态单页网站，零构建、零依赖：

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面骨架、导航、页脚 |
| `styles.css` | 暗色复古爵士视觉 |
| `app.js` | hash 路由、渲染、搜索、封面懒加载（IntersectionObserver） |
| `data.js` | 1001 张专辑数据（`window.ALBUMS` / `window.ERAS`；`window.SONGS` 为兼容别名） |

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

- [x] 以**专辑**为单位重构：1001 张必听专辑（13 时期分布，人工策展 + 中文导读）
- [x] 真实专辑封面（iTunes Search，懒加载 + 本地缓存）
- [ ] 数据迁移至 CSV/JSON 或 Supabase
- [ ] Pagefind / Meilisearch 全文搜索
- [ ] 艺术家小传

---

1001 系列 · 聆听地图
