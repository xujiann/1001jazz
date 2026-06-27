# CLAUDE.md — 1001 Jazz 项目协作说明

## 项目
1001 Jazz 是一个纯静态、零构建的单页爵士乐**策展**网站(不是播放器)。
中文界面,主题「一千零一张爵士必听专辑」。

## 文件结构
- `index.html` — 页面骨架、导航、页脚
- `styles.css` — 暗色复古视觉(用 CSS 变量做主题)
- `app.js` — hash 路由、渲染、搜索、封面懒加载(IIFE,纯前端,无依赖)
- `data.js` — 1001 张专辑数据(`window.ALBUMS` / `ERAS` / `MOODS` / `INSTRUMENTS` / `FEATURED_ARTISTS`;`window.SONGS` 为兼容别名)
- `artists.js` — 艺术家小传(`window.ARTIST_BIOS`,以专辑英文 `artist` 串为键:译名/生卒/国别/身份/中文小传;无词条者优雅降级)
- `README.md` — 面向人的项目说明
- `update-github.bat` / `push-to-github.bat` — 一键提交推送脚本

## 运行 / 预览
直接用浏览器打开 `index.html`,或起本地服务器:
`python -m http.server 8000` → 访问 http://localhost:8000

## 合法性原则(重要)
不托管任何音频。「收听」按钮一律跳转到各平台搜索页:网易云音乐、QQ音乐、
Spotify、Apple Music、YouTube、Bandcamp、豆瓣。专辑封面取自 iTunes Search API
(`entity=album`,懒加载 + localStorage 缓存),失败时回退为程序化生成的视觉占位。

## 编码约定
所有源文件均为 UTF-8 且含大量中文,务必保持 UTF-8。`app.js` / `data.js` / `styles.css`
体量较大、中文密集;大范围改动后用 `node --check app.js`、CSS 花括号配平等做自检。

## 当前状态(2026-06)
- 已有「关于」独立页(`#/about`),含说明与开发者信息(xujiann / popstudy@gmail.com)
- 收听支持 7 个平台并带品牌图标;封面悬停有 网易云/Spotify/YouTube 三个快捷播放键;
  程序化封面的黑胶在悬停时缓慢旋转
- 最新改动已推送到 origin/main(提交 `425cad0`)

## Git / 推送
本机已配置 GitHub 凭据。常规流程:
`git add -A && git commit -m "说明" && git push`,或双击 `update-github.bat`。

## 路线图(可选方向)
- 数据迁移到 CSV/JSON 或 Supabase
- 全文搜索(Pagefind / Meilisearch)
- ✅ 艺术家小传(已完成:`artists.js`,175 位,覆盖约 63% 专辑;人物页小传卡+按时期分组时间线,首页精选艺术家模块,搜索支持中文译名)。可继续扩充到更多艺术家。
