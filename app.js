/* 1001 Jazz — 单页应用，hash 路由，纯前端渲染 */
(function(){
  "use strict";
  const SONGS = window.SONGS, ERAS = window.ERAS;
  const eraMap = Object.fromEntries(ERAS.map(e=>[e.key,e]));
  const app = document.getElementById("app");

  /* ---------- 工具 ---------- */
  const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const enc = encodeURIComponent;

  // 字符串 -> 稳定色相
  function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;}return Math.abs(h);}
  // 不同唱片公司给一组主题色
  const LABEL_THEME = {
    "Blue Note":["#1c3a5e","#0d1b2e"], "Columbia":["#7a1f1f","#2a0d0d"],
    "Impulse!":["#b5471f","#3a1408"], "Verve":["#2d2466","#120f2e"],
    "ECM":["#2b3a3f","#0e1416"], "Atlantic":["#1d5b54","#08201d"],
    "Prestige":["#5a3d18","#1f1408"], "Capitol":["#6b1f4d","#220a18"],
    "RCA Victor":["#5e2b2b","#1f0e0e"], "Brainfeeder":["#3a1d66","#13082b"],
    "Victor":["#4a3a1d","#181208"], "Decca":["#3a2d5e","#120e22"]
  };
  function coverHTML(s,big){
    const theme = LABEL_THEME[s.label];
    let c1,c2;
    if(theme){[c1,c2]=theme;}
    else{const h=hashStr(s.artist+s.title)%360; c1=`hsl(${h} 42% 30%)`; c2=`hsl(${(h+40)%360} 48% 12%)`;}
    const accent = `hsl(${(hashStr(s.title)*7)%360} 60% 55%)`;
    const fs = big?"2.1rem":"1.25rem";
    return `<div class="cover" data-song="${s.id}" style="background:linear-gradient(150deg,${c1},${c2})">
      <span class="c-label">${esc(s.label||"—")}</span>
      <div class="c-disc"></div>
      <div class="c-title" style="font-size:${fs}">
        <span style="display:block;width:34px;height:3px;background:${accent};margin:0 auto .5rem"></span>
        ${esc(s.title)}
      </div>
      <span class="c-year">${s.year}</span>
      <img class="cover-img" alt="${esc(s.title)} — ${esc(s.artist)} 专辑封面" loading="lazy">
    </div>`;
  }

  /* ---------- 真实专辑封面：iTunes Search API（客户端 JSONP + 缓存，失败回退程序化封面） ---------- */
  const coverCache = {};
  let jsonpSeq = 0;
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function pickArtwork(song,data){
    if(!data||!data.results||!data.results.length) return "";
    const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const wantA=norm(song.artist), wantT=norm(song.title);
    let best=data.results[0],score=-1;
    data.results.forEach(r=>{
      const a=norm(r.artistName), t=norm(r.trackName||r.collectionName);
      let sc=0;
      if(wantA&&(a.includes(wantA)||wantA.includes(a))) sc+=2;
      if(wantT&&(t.includes(wantT)||wantT.includes(t))) sc+=2;
      if(sc>score){score=sc;best=r;}
    });
    const url=best.artworkUrl100||best.artworkUrl60||"";
    return url.replace(/\/\d+x\d+bb\.(jpg|png)/,"/600x600bb.$1");
  }
  function applyCover(imgEl,url){
    if(!url||!imgEl) return;
    imgEl.onload=()=>imgEl.classList.add("loaded");
    imgEl.src=url;
  }
  function loadCover(song,imgEl){
    if(song.id in coverCache){ applyCover(imgEl,coverCache[song.id]); return; }
    const key="cov:"+song.id, cached=lsGet(key);
    if(cached){ coverCache[song.id]=cached; applyCover(imgEl,cached); return; }
    const cbName="__jzcb"+(jsonpSeq++);
    const term=enc(song.artist+" "+song.title);
    const sc=document.createElement("script");
    let done=false;
    const finish=url=>{ if(done)return; done=true; try{delete window[cbName];}catch(e){} sc.remove();
      coverCache[song.id]=url; if(url) lsSet(key,url); applyCover(imgEl,url); };
    window[cbName]=data=>finish(pickArtwork(song,data));
    sc.onerror=()=>finish("");
    sc.src=`https://itunes.apple.com/search?term=${term}&entity=song&limit=10&callback=${cbName}`;
    document.body.appendChild(sc);
    setTimeout(()=>finish(""),9000);
  }
  function hydrateCovers(){
    document.querySelectorAll(".cover[data-song]").forEach(c=>{
      const img=c.querySelector(".cover-img");
      const song=SONGS.find(s=>s.id===c.getAttribute("data-song"));
      if(song&&img&&!img.src) loadCover(song,img);
    });
  }

  function listenLinks(s){
    const q = enc(`${s.artist} ${s.title}`);
    return [
      {n:"Spotify",  u:`https://open.spotify.com/search/${q}`},
      {n:"YouTube",  u:`https://www.youtube.com/results?search_query=${q}`},
      {n:"Apple Music", u:`https://music.apple.com/search?term=${q}`},
      {n:"Bandcamp", u:`https://bandcamp.com/search?q=${q}`}
    ];
  }

  function songCard(s){
    return `<article class="song-card" onclick="location.hash='#/song/${s.id}'">
      ${coverHTML(s)}
      <div class="meta">
        <div class="s-title">${esc(s.title)}</div>
        <div class="s-artist">${esc(s.artist)}</div>
        <div class="s-sub">${s.year} · ${esc((eraMap[s.era]||{}).name||s.era)}</div>
      </div>
    </article>`;
  }
  const grid = list => list.length
    ? `<div class="grid cols">${list.map(songCard).join("")}</div>`
    : `<p class="empty">这里还没有曲目。</p>`;

  function crumb(){ return `<div class="crumb"><a href="#/">← 返回首页</a></div>`; }

  /* ---------- 首页 ---------- */
  function home(){
    // 今日一首：按日期稳定选取
    const day = Math.floor(Date.now()/864e5);
    const pick = SONGS[day % SONGS.length];
    const featured = SONGS.filter((_,i)=>[5,11,17,21,24,29,35,41,53,60,71]   .includes(i)); // 视觉入口精选
    const tl = ERAS.map(e=>{
      const n = SONGS.filter(s=>s.era===e.key).length;
      return `<div class="tl-card" onclick="location.hash='#/era/${e.key}'">
        <div class="yr">${e.years}</div>
        <div class="nm">${esc(e.name.split(" / ")[0])}</div>
        <div class="kw">${esc(e.keywords)}</div>
        <div class="ct">${n} 首 →</div>
      </div>`;
    }).join("");

    return `
    <section class="hero">
      <div class="kicker">从新奥尔良到伦敦 · 从78转唱片到流媒体</div>
      <h1>一千零一首<br><em>爵士乐</em>入门地图</h1>
      <p class="lead">按年代、流派、人物、唱片与封面进入爵士乐史。每首歌旁边，是一段告诉你“它为什么重要、该听什么”的中文导读。</p>
      <div class="stat-row">
        <div class="stat"><b>${SONGS.length}</b><span>样板曲目</span></div>
        <div class="stat"><b>${ERAS.length}</b><span>历史时期</span></div>
        <div class="stat"><b>${window.MOODS.length}</b><span>心情入口</span></div>
        <div class="stat"><b>${window.INSTRUMENTS.length}</b><span>乐器入口</span></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>年代时间轴</h2><span class="tag">Timeline · 13 eras</span></div>
      <div class="timeline">${tl}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>今日一首</h2><span class="tag">Today's Pick</span></div>
      <div class="today">
        <div onclick="location.hash='#/song/${pick.id}'" style="cursor:pointer">${coverHTML(pick,true)}</div>
        <div class="t-body">
          <h3>${esc(pick.title)}</h3>
          <div class="t-artist">${esc(pick.artist)} · ${pick.year}</div>
          <p>${esc(pick.reason)}</p>
          <a class="btn solid" href="#/song/${pick.id}">查看详情与试听 →</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>封面瀑布流</h2><span class="tag">Cover Wall</span>
        <a href="#/all" class="muted" style="margin-left:auto;font-family:var(--label);font-size:.85rem">浏览全部 →</a></div>
      <div class="grid cols">${featured.map(songCard).join("")}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>多种方式进入</h2><span class="tag">Browse</span></div>
      <div class="tile-grid">
        <div class="tile" onclick="location.hash='#/eras'"><div class="t-k">BY ERA</div><h3>按年代</h3><p>13 个时期，从拉格泰姆到全球新爵士。</p></div>
        <div class="tile" onclick="location.hash='#/genres'"><div class="t-k">BY GENRE</div><h3>按流派</h3><p>比波普、冷爵士、调式、自由、融合…</p></div>
        <div class="tile" onclick="location.hash='#/artists'"><div class="t-k">BY ARTIST</div><h3>按人物</h3><p>迈尔斯、科尔特兰、蒙克、明格斯…</p></div>
        <div class="tile" onclick="location.hash='#/moods'"><div class="t-k">BY MOOD</div><h3>按心情</h3><p>夜晚、雨天、咖啡馆、阅读、开车、失眠…</p></div>
        <div class="tile" onclick="location.hash='#/instruments'"><div class="t-k">BY INSTRUMENT</div><h3>按乐器</h3><p>小号、萨克斯、钢琴、贝斯、鼓、人声…</p></div>
        <div class="tile" onclick="location.hash='#/all'"><div class="t-k">EVERYTHING</div><h3>全部曲库</h3><p>${SONGS.length} 首样板曲，可搜索可筛选。</p></div>
      </div>
    </section>`;
  }

  /* ---------- 年代 ---------- */
  function erasPage(){
    const tiles = ERAS.map(e=>{
      const n=SONGS.filter(s=>s.era===e.key).length;
      return `<div class="tile" onclick="location.hash='#/era/${e.key}'">
        <div class="t-k">${e.years}</div><h3>${esc(e.name)}</h3>
        <p>${esc(e.keywords)}</p><div class="cnt">${n} 首 →</div></div>`;
    }).join("");
    return `${crumb()}<div class="section-head"><h2>按年代进入</h2><span class="tag">13 Eras</span></div>
      <div class="tile-grid">${tiles}</div>`;
  }
  function eraPage(key){
    const e=eraMap[key]; if(!e) return notFound();
    const list=SONGS.filter(s=>s.era===key);
    return `${crumb()}
      <div class="era-hero"><div class="yr">${e.years} · ${esc(e.keywords)}</div>
        <h1>${esc(e.name)}</h1><p>${esc(e.desc)}</p></div>
      <div class="section-head"><h2>本时期曲目</h2><span class="tag">${list.length} tracks</span></div>
      ${grid(list)}`;
  }

  /* ---------- 流派 ---------- */
  function allGenres(){
    const m={};SONGS.forEach(s=>s.genres.forEach(g=>m[g]=(m[g]||0)+1));
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  function genresPage(){
    const tiles=allGenres().map(([g,n])=>
      `<div class="tile" onclick="location.hash='#/genre/${enc(g)}'"><div class="t-k">GENRE</div>
       <h3>${esc(g)}</h3><div class="cnt">${n} 首 →</div></div>`).join("");
    return `${crumb()}<div class="section-head"><h2>按流派进入</h2><span class="tag">Genres</span></div>
      <div class="tile-grid">${tiles}</div>`;
  }
  function genrePage(g){
    const list=SONGS.filter(s=>s.genres.includes(g));
    return `${crumb()}<div class="section-head"><h2>流派 · ${esc(g)}</h2><span class="tag">${list.length} tracks</span></div>${grid(list)}`;
  }

  /* ---------- 人物 ---------- */
  function artistsPage(){
    const m={};SONGS.forEach(s=>m[s.artist]=(m[s.artist]||0)+1);
    const feat=(window.FEATURED_ARTISTS||[]);
    const ordered=Object.keys(m).sort((a,b)=>{
      const fa=feat.indexOf(a),fb=feat.indexOf(b);
      if(fa>=0&&fb>=0)return fa-fb; if(fa>=0)return -1; if(fb>=0)return 1; return a.localeCompare(b);
    });
    const tiles=ordered.map(a=>
      `<div class="tile" onclick="location.hash='#/artist/${enc(a)}'"><div class="t-k">ARTIST</div>
       <h3>${esc(a)}</h3><div class="cnt">${m[a]} 首 →</div></div>`).join("");
    return `${crumb()}<div class="section-head"><h2>按人物进入</h2><span class="tag">Artists</span></div>
      <div class="tile-grid">${tiles}</div>`;
  }
  function artistPage(a){
    const list=SONGS.filter(s=>s.artist===a);
    if(!list.length) return notFound();
    return `${crumb()}<div class="section-head"><h2>${esc(a)}</h2><span class="tag">${list.length} tracks</span></div>${grid(list)}`;
  }

  /* ---------- 心情 / 乐器 ---------- */
  function moodsPage(){
    const tiles=window.MOODS.map(m=>{
      const n=SONGS.filter(s=>s.moods.includes(m)).length;
      return `<div class="tile" onclick="location.hash='#/mood/${enc(m)}'"><div class="t-k">MOOD</div>
        <h3>${esc(m)}</h3><div class="cnt">${n} 首 →</div></div>`;}).join("");
    return `${crumb()}<div class="section-head"><h2>按心情进入</h2><span class="tag">Moods</span></div><div class="tile-grid">${tiles}</div>`;
  }
  function moodPage(m){
    const list=SONGS.filter(s=>s.moods.includes(m));
    return `${crumb()}<div class="section-head"><h2>心情 · ${esc(m)}</h2><span class="tag">${list.length} tracks</span></div>${grid(list)}`;
  }
  function instrumentsPage(){
    const tiles=window.INSTRUMENTS.map(i=>{
      const n=SONGS.filter(s=>s.instruments.includes(i)).length;
      return `<div class="tile" onclick="location.hash='#/instrument/${enc(i)}'"><div class="t-k">INSTRUMENT</div>
        <h3>${esc(i)}</h3><div class="cnt">${n} 首 →</div></div>`;}).join("");
    return `${crumb()}<div class="section-head"><h2>按乐器进入</h2><span class="tag">Instruments</span></div><div class="tile-grid">${tiles}</div>`;
  }
  function instrumentPage(i){
    const list=SONGS.filter(s=>s.instruments.includes(i));
    return `${crumb()}<div class="section-head"><h2>乐器 · ${esc(i)}</h2><span class="tag">${list.length} tracks</span></div>${grid(list)}`;
  }

  /* ---------- 全部 / 搜索 ---------- */
  function allPage(q){
    q=(q||"").trim().toLowerCase();
    let list=SONGS;
    if(q){
      list=SONGS.filter(s=>(s.title+s.artist+s.album+s.composer+s.label+s.genres.join(" ")+(eraMap[s.era]||{}).name)
        .toLowerCase().includes(q));
    }
    const head=q
      ? `<div class="section-head"><h2>搜索 “${esc(q)}”</h2><span class="tag">${list.length} 个结果</span></div>`
      : `<div class="section-head"><h2>全部曲库</h2><span class="tag">${list.length} tracks</span></div>`;
    return `${crumb()}${head}${grid(list)}`;
  }

  /* ---------- 详情 ---------- */
  function songPage(id){
    const s=SONGS.find(x=>x.id===id); if(!s) return notFound();
    const e=eraMap[s.era]||{};
    const links=listenLinks(s).map(l=>`<a class="btn" href="${l.u}" target="_blank" rel="noopener">${l.n} ↗</a>`).join("");
    const tag=(label,val,href)=> val?`<dt>${label}</dt><dd>${href?`<a href="${href}">${esc(val)}</a>`:esc(val)}</dd>`:"";
    const tagLinks=(arr,kind)=>arr.map(v=>`<a href="#/${kind}/${enc(v)}">${esc(v)}</a>`).join("");
    // 延伸阅读：同年代/同艺术家/同流派
    const related=SONGS.filter(x=>x.id!==s.id &&
      (x.era===s.era || x.artist===s.artist || x.genres.some(g=>s.genres.includes(g))))
      .slice(0,6);
    return `${crumb()}
    <div class="detail">
      <div>${coverHTML(s,true)}
        <div class="btn-row" style="margin-top:1rem">${links}</div>
        <p class="muted" style="font-size:.74rem;margin-top:.6rem">试听跳转至各平台搜索；本站不托管音频。</p>
      </div>
      <div>
        <h1>${esc(s.title)}</h1>
        <div class="d-artist">${esc(s.artist)}</div>
        <div class="tags">${tagLinks(s.genres,"genre")}</div>
        <dl class="facts">
          ${tag("艺术家",s.artist,`#/artist/${enc(s.artist)}`)}
          ${tag("作曲",s.composer)}
          ${tag("年代",s.year)}
          ${tag("专辑",s.album)}
          ${tag("唱片公司",s.label)}
          ${tag("所属流派",e.name,`#/era/${s.era}`)}
        </dl>
        <div class="tags"><span class="muted" style="font-family:var(--label);font-size:.78rem;align-self:center">乐器：</span>${tagLinks(s.instruments,"instrument")}</div>
        <div class="tags"><span class="muted" style="font-family:var(--label);font-size:.78rem;align-self:center">心情：</span>${tagLinks(s.moods,"mood")}</div>
        <div class="reason"><h4>推荐理由 · 中文导读</h4>${esc(s.reason)}</div>
      </div>
    </div>
    <div class="related section">
      <h4>延伸阅读 · 同年代 / 同艺术家 / 同流派</h4>
      <div class="grid cols">${related.map(songCard).join("")}</div>
    </div>`;
  }

  function notFound(){return `${crumb()}<p class="empty">没有找到这个页面。</p>`;}

  /* ---------- 路由 ---------- */
  function router(){
    const h=location.hash.replace(/^#\/?/,"");
    const [path,query]=h.split("?");
    const parts=path.split("/").filter(Boolean).map(decodeURIComponent);
    let html;
    switch(parts[0]){
      case undefined: case "": html=home();break;
      case "eras": html=erasPage();break;
      case "era": html=eraPage(parts[1]);break;
      case "genres": html=genresPage();break;
      case "genre": html=genrePage(parts[1]);break;
      case "artists": html=artistsPage();break;
      case "artist": html=artistPage(parts[1]);break;
      case "moods": html=moodsPage();break;
      case "mood": html=moodPage(parts[1]);break;
      case "instruments": html=instrumentsPage();break;
      case "instrument": html=instrumentPage(parts[1]);break;
      case "song": html=songPage(parts[1]);break;
      case "all": html=allPage(parts[1]);break;
      case "search":{const m=/q=([^&]*)/.exec(query||"");html=allPage(m?decodeURIComponent(m[1]):"");break;}
      default: html=notFound();
    }
    app.innerHTML=html;
    window.scrollTo({top:0,behavior:"instant"});
    hydrateCovers();
  }
  window.addEventListener("hashchange",router);
  window.addEventListener("DOMContentLoaded",router);

  /* ---------- 搜索框 ---------- */
  function bindSearch(){
    const inp=document.getElementById("globalSearch");
    if(!inp)return;
    inp.addEventListener("keydown",ev=>{
      if(ev.key==="Enter"){location.hash="#/search?q="+enc(inp.value.trim());}
    });
  }
  document.addEventListener("DOMContentLoaded",bindSearch);

  if(document.readyState!=="loading"){ router(); bindSearch(); }
})();
