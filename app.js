/* 1001 Jazz — 单页应用，hash 路由，纯前端渲染。以「专辑」为单位。 */
(function(){
  "use strict";
  const ALBUMS = window.ALBUMS, ERAS = window.ERAS;
  const eraMap = Object.fromEntries(ERAS.map(e=>[e.key,e]));
  const app = document.getElementById("app");

  /* ---------- 工具 ---------- */
  const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const enc = encodeURIComponent;

  function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;}return Math.abs(h);}
  const LABEL_THEME = {
    "Blue Note":["#1c3a5e","#0d1b2e"], "Columbia":["#7a1f1f","#2a0d0d"],
    "Impulse!":["#b5471f","#3a1408"], "Verve":["#2d2466","#120f2e"],
    "ECM":["#2b3a3f","#0e1416"], "Atlantic":["#1d5b54","#08201d"],
    "Prestige":["#5a3d18","#1f1408"], "Capitol":["#6b1f4d","#220a18"],
    "RCA Victor":["#5e2b2b","#1f0e0e"], "Brainfeeder":["#3a1d66","#13082b"],
    "Riverside":["#244a2c","#0c1a10"], "Pacific Jazz":["#2a3d63","#0d1322"],
    "Contemporary":["#5a4a1d","#1c1608"], "Decca":["#3a2d5e","#120e22"]
  };
  const PLAY_ICONS = {
    spotify:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.59 14.42a.62.62 0 01-.86.21c-2.35-1.44-5.31-1.76-8.79-.96a.63.63 0 01-.28-1.22c3.81-.87 7.08-.5 9.72 1.11a.62.62 0 01.21.86zm1.22-2.72a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 11-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.37.23.49.71.25 1.07zm.11-2.84C14.8 8.93 9.5 8.74 6.42 9.67a.93.93 0 11-.54-1.79c3.53-1.07 9.38-.86 13.08 1.34a.94.94 0 01-.96 1.6z"/></svg>',
    youtube:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
  };
  function coverHTML(a,big,quick){
    const theme = LABEL_THEME[a.label];
    let c1,c2;
    if(theme){[c1,c2]=theme;}
    else{const h=hashStr(a.artist+a.title)%360; c1=`hsl(${h} 42% 30%)`; c2=`hsl(${(h+40)%360} 48% 12%)`;}
    const accent = `hsl(${(hashStr(a.title)*7)%360} 60% 55%)`;
    const fs = big?"2.1rem":"1.2rem";
    let overlay = "";
    if(quick){
      const L = listenLinks(a), yt=L.find(x=>x.k==="youtube"), sp=L.find(x=>x.k==="spotify");
      overlay = `<div class="c-play">
        <a class="cp-btn cp-yt" href="${yt.u}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="在 YouTube 播放" aria-label="在 YouTube 播放">${PLAY_ICONS.youtube}</a>
        <a class="cp-btn cp-sp" href="${sp.u}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="在 Spotify 播放" aria-label="在 Spotify 播放">${PLAY_ICONS.spotify}</a>
      </div>`;
    }
    return `<div class="cover" data-album="${a.id}" style="background:linear-gradient(150deg,${c1},${c2})">
      <span class="c-label">${esc(a.label||"—")}</span>
      <div class="c-disc"></div>
      <div class="c-title" style="font-size:${fs}">
        <span style="display:block;width:34px;height:3px;background:${accent};margin:0 auto .5rem"></span>
        ${esc(a.title.replace(/^[^:]+:\s*/,""))}
      </div>
      <span class="c-year">${a.year}</span>
      <img class="cover-img" alt="${esc(a.title)} — ${esc(a.artist)} 专辑封面" loading="lazy">
      ${overlay}
    </div>`;
  }

  /* ---------- 真实专辑封面：iTunes Search API（entity=album，客户端 JSONP + 缓存，失败回退程序化封面） ---------- */
  const coverCache = {};
  let jsonpSeq = 0;
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  // 专辑标题常带 "Artist: Album" 前缀，搜索时取冒号后的纯专辑名
  function albumQuery(a){
    let t = a.title;
    const i = t.indexOf(": ");
    if(i>0 && t.slice(0,i).toLowerCase().includes(a.artist.split(" ")[0].toLowerCase())) t = t.slice(i+2);
    t = t.replace(/\s*\([^)]*\)\s*$/,"").trim();
    return a.artist + " " + t;
  }
  function pickArtwork(album,data){
    if(!data||!data.results||!data.results.length) return "";
    const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const wantA=norm(album.artist), wantT=norm(album.title.replace(/^[^:]+:\s*/,""));
    let best=data.results[0],score=-1;
    data.results.forEach(r=>{
      const a=norm(r.artistName), t=norm(r.collectionName||r.trackName);
      let sc=0;
      if(wantA&&(a.includes(wantA)||wantA.includes(a))) sc+=2;
      if(wantT&&(t.includes(wantT)||wantT.includes(t))) sc+=3;
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
  function loadCover(album,imgEl){
    if(album.id in coverCache){ applyCover(imgEl,coverCache[album.id]); return; }
    const key="cov2:"+album.id, cached=lsGet(key);
    if(cached){ coverCache[album.id]=cached; applyCover(imgEl,cached); return; }
    const cbName="__jzcb"+(jsonpSeq++);
    const term=enc(albumQuery(album));
    const sc=document.createElement("script");
    let done=false;
    const finish=url=>{ if(done)return; done=true; try{delete window[cbName];}catch(e){} sc.remove();
      coverCache[album.id]=url; if(url) lsSet(key,url); applyCover(imgEl,url); };
    window[cbName]=data=>finish(pickArtwork(album,data));
    sc.onerror=()=>finish("");
    sc.src=`https://itunes.apple.com/search?term=${term}&entity=album&limit=8&callback=${cbName}`;
    document.body.appendChild(sc);
    setTimeout(()=>finish(""),9000);
  }
  // 懒加载：仅在封面进入视口附近时才请求 iTunes，避免一次性发出上千请求
  let coverObserver=null;
  function ensureObserver(){
    if(coverObserver||typeof IntersectionObserver==="undefined") return coverObserver;
    coverObserver=new IntersectionObserver((entries,obs)=>{
      entries.forEach(en=>{
        if(!en.isIntersecting) return;
        const c=en.target, img=c.querySelector(".cover-img");
        const album=ALBUMS.find(a=>a.id===c.getAttribute("data-album"));
        obs.unobserve(c);
        if(album&&img&&!img.src) loadCover(album,img);
      });
    },{rootMargin:"300px"});
    return coverObserver;
  }
  function hydrateCovers(){
    const covers=document.querySelectorAll(".cover[data-album]");
    const obs=ensureObserver();
    covers.forEach(c=>{
      const img=c.querySelector(".cover-img");
      if(!img||img.src) return;
      if(obs) obs.observe(c);
      else{ const album=ALBUMS.find(a=>a.id===c.getAttribute("data-album")); if(album) loadCover(album,img); }
    });
  }

  function listenLinks(a){
    const q = enc(`${a.artist} ${a.title.replace(/^[^:]+:\s*/,"")}`);
    return [
      {n:"Spotify",  k:"spotify",  u:`https://open.spotify.com/search/${q}`},
      {n:"YouTube",  k:"youtube",  u:`https://www.youtube.com/results?search_query=${q}`},
      {n:"Apple Music", k:"apple", u:`https://music.apple.com/search?term=${q}`},
      {n:"Bandcamp", k:"bandcamp", u:`https://bandcamp.com/search?q=${q}`},
      {n:"豆瓣", k:"douban", u:`https://search.douban.com/music/subject_search?search_text=${q}`}
    ];
  }

  function albumCard(a){
    return `<article class="song-card" onclick="location.hash='#/album/${a.id}'">
      ${coverHTML(a,false,true)}
      <div class="meta">
        <div class="s-title">${esc(a.title.replace(/^[^:]+:\s*/,""))}</div>
        <div class="s-artist">${esc(a.artist)}</div>
        <div class="s-sub">${a.year} · ${esc((eraMap[a.era]||{}).name.split(" / ")[0]||a.era)}</div>
      </div>
    </article>`;
  }
  const grid = list => list.length
    ? `<div class="grid cols">${list.map(albumCard).join("")}</div>`
    : `<p class="empty">这里还没有专辑。</p>`;

  function crumb(){ return `<div class="crumb"><a href="#/">← 返回首页</a></div>`; }

  /* ---------- 首页 ---------- */
  function home(){
    const day = Math.floor(Date.now()/864e5);
    const pick = ALBUMS[day % ALBUMS.length];
    const featured = ALBUMS.filter((_,i)=>[5,11,17,21,24,29,35,41,53,60,71].includes(i));
    const tl = ERAS.map(e=>{
      const n = ALBUMS.filter(a=>a.era===e.key).length;
      return `<div class="tl-card" onclick="location.hash='#/era/${e.key}'">
        <div class="yr">${e.years}</div>
        <div class="nm">${esc(e.name.split(" / ")[0])}</div>
        <div class="kw">${esc(e.keywords)}</div>
        <div class="ct">${n} 张 →</div>
      </div>`;
    }).join("");

    return `
    <section class="hero">
      <div class="kicker">从新奥尔良到伦敦 · 从78转唱片到流媒体</div>
      <h1>一千零一张<br><em>爵士</em>必听专辑</h1>
      <p class="lead">按年代、流派、人物、唱片公司与封面进入爵士乐史。每张专辑旁边，是一段告诉你"它为什么重要、该从哪听起"的中文导读。</p>
      <div class="stat-row">
        <div class="stat"><b>${ALBUMS.length}</b><span>张专辑</span></div>
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
      <div class="section-head"><h2>今日一张</h2><span class="tag">Today's Pick</span></div>
      <div class="today">
        <div onclick="location.hash='#/album/${pick.id}'" style="cursor:pointer">${coverHTML(pick,true,true)}</div>
        <div class="t-body">
          <h3>${esc(pick.title.replace(/^[^:]+:\s*/,""))}</h3>
          <div class="t-artist">${esc(pick.artist)} · ${pick.year} · ${esc(pick.label)}</div>
          <p>${esc(pick.reason)}</p>
          <a class="btn solid" href="#/album/${pick.id}">查看详情与试听 →</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>封面瀑布流</h2><span class="tag">Cover Wall</span>
        <a href="#/all" class="muted" style="margin-left:auto;font-family:var(--label);font-size:.85rem">浏览全部 →</a></div>
      <div class="grid cols">${featured.map(albumCard).join("")}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>多种方式进入</h2><span class="tag">Browse</span></div>
      <div class="tile-grid">
        <div class="tile" onclick="location.hash='#/eras'"><div class="t-k">BY ERA</div><h3>按年代</h3><p>13 个时期，从拉格泰姆到全球新爵士。</p></div>
        <div class="tile" onclick="location.hash='#/genres'"><div class="t-k">BY GENRE</div><h3>按流派</h3><p>比波普、冷爵士、调式、自由、融合…</p></div>
        <div class="tile" onclick="location.hash='#/artists'"><div class="t-k">BY ARTIST</div><h3>按人物</h3><p>迈尔斯、科尔特兰、蒙克、明格斯…</p></div>
        <div class="tile" onclick="location.hash='#/moods'"><div class="t-k">BY MOOD</div><h3>按心情</h3><p>夜晚、雨天、咖啡馆、阅读、开车、失眠…</p></div>
        <div class="tile" onclick="location.hash='#/instruments'"><div class="t-k">BY INSTRUMENT</div><h3>按乐器</h3><p>小号、萨克斯、钢琴、风琴、贝斯、鼓…</p></div>
        <div class="tile" onclick="location.hash='#/all'"><div class="t-k">EVERYTHING</div><h3>全部专辑</h3><p>${ALBUMS.length} 张专辑，可搜索可筛选。</p></div>
      </div>
    </section>`;
  }

  /* ---------- 年代 ---------- */
  function erasPage(){
    const tiles = ERAS.map(e=>{
      const n=ALBUMS.filter(a=>a.era===e.key).length;
      return `<div class="tile" onclick="location.hash='#/era/${e.key}'">
        <div class="t-k">${e.years}</div><h3>${esc(e.name)}</h3>
        <p>${esc(e.keywords)}</p><div class="cnt">${n} 张 →</div></div>`;
    }).join("");
    return `${crumb()}<div class="section-head"><h2>按年代进入</h2><span class="tag">13 Eras</span></div>
      <div class="tile-grid">${tiles}</div>`;
  }
  function eraPage(key){
    const e=eraMap[key]; if(!e) return notFound();
    const list=ALBUMS.filter(a=>a.era===key);
    return `${crumb()}
      <div class="era-hero"><div class="yr">${e.years} · ${esc(e.keywords)}</div>
        <h1>${esc(e.name)}</h1><p>${esc(e.desc)}</p></div>
      <div class="section-head"><h2>本时期专辑</h2><span class="tag">${list.length} albums</span></div>
      ${grid(list)}`;
  }

  /* ---------- 流派 ---------- */
  function allGenres(){
    const m={};ALBUMS.forEach(a=>a.genres.forEach(g=>m[g]=(m[g]||0)+1));
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  function genresPage(){
    const tiles=allGenres().map(([g,n])=>
      `<div class="tile" onclick="location.hash='#/genre/${enc(g)}'"><div class="t-k">GENRE</div>
       <h3>${esc(g)}</h3><div class="cnt">${n} 张 →</div></div>`).join("");
    return `${crumb()}<div class="section-head"><h2>按流派进入</h2><span class="tag">Genres</span></div>
      <div class="tile-grid">${tiles}</div>`;
  }
  function genrePage(g){
    const list=ALBUMS.filter(a=>a.genres.includes(g));
    return `${crumb()}<div class="section-head"><h2>流派 · ${esc(g)}</h2><span class="tag">${list.length} albums</span></div>${grid(list)}`;
  }

  /* ---------- 人物 ---------- */
  function artistsPage(){
    const m={};ALBUMS.forEach(a=>m[a.artist]=(m[a.artist]||0)+1);
    const feat=(window.FEATURED_ARTISTS||[]);
    const ordered=Object.keys(m).sort((a,b)=>{
      const fa=feat.indexOf(a),fb=feat.indexOf(b);
      if(fa>=0&&fb>=0)return fa-fb; if(fa>=0)return -1; if(fb>=0)return 1; return a.localeCompare(b);
    });
    const tiles=ordered.map(a=>
      `<div class="tile" onclick="location.hash='#/artist/${enc(a)}'"><div class="t-k">ARTIST</div>
       <h3>${esc(a)}</h3><div class="cnt">${m[a]} 张 →</div></div>`).join("");
    return `${crumb()}<div class="section-head"><h2>按人物进入</h2><span class="tag">${ordered.length} Artists</span></div>
      <div class="tile-grid">${tiles}</div>`;
  }
  function artistPage(a){
    const list=ALBUMS.filter(x=>x.artist===a).sort((x,y)=>x.year-y.year);
    if(!list.length) return notFound();
    return `${crumb()}<div class="section-head"><h2>${esc(a)}</h2><span class="tag">${list.length} albums</span></div>${grid(list)}`;
  }

  /* ---------- 心情 / 乐器 ---------- */
  function moodsPage(){
    const tiles=window.MOODS.map(m=>{
      const n=ALBUMS.filter(a=>a.moods.includes(m)).length;
      return `<div class="tile" onclick="location.hash='#/mood/${enc(m)}'"><div class="t-k">MOOD</div>
        <h3>${esc(m)}</h3><div class="cnt">${n} 张 →</div></div>`;}).join("");
    return `${crumb()}<div class="section-head"><h2>按心情进入</h2><span class="tag">Moods</span></div><div class="tile-grid">${tiles}</div>`;
  }
  function moodPage(m){
    const list=ALBUMS.filter(a=>a.moods.includes(m));
    return `${crumb()}<div class="section-head"><h2>心情 · ${esc(m)}</h2><span class="tag">${list.length} albums</span></div>${grid(list)}`;
  }
  function instrumentsPage(){
    const tiles=window.INSTRUMENTS.map(i=>{
      const n=ALBUMS.filter(a=>a.instruments.includes(i)).length;
      return `<div class="tile" onclick="location.hash='#/instrument/${enc(i)}'"><div class="t-k">INSTRUMENT</div>
        <h3>${esc(i)}</h3><div class="cnt">${n} 张 →</div></div>`;}).join("");
    return `${crumb()}<div class="section-head"><h2>按乐器进入</h2><span class="tag">Instruments</span></div><div class="tile-grid">${tiles}</div>`;
  }
  function instrumentPage(i){
    const list=ALBUMS.filter(a=>a.instruments.includes(i));
    return `${crumb()}<div class="section-head"><h2>乐器 · ${esc(i)}</h2><span class="tag">${list.length} albums</span></div>${grid(list)}`;
  }

  /* ---------- 全部 / 搜索 ---------- */
  function allPage(q){
    q=(q||"").trim().toLowerCase();
    let list=ALBUMS;
    if(q){
      list=ALBUMS.filter(a=>(a.title+a.artist+a.label+a.genres.join(" ")+(eraMap[a.era]||{}).name)
        .toLowerCase().includes(q));
    }
    const head=q
      ? `<div class="section-head"><h2>搜索 "${esc(q)}"</h2><span class="tag">${list.length} 个结果</span></div>`
      : `<div class="section-head"><h2>全部专辑</h2><span class="tag">${list.length} albums</span></div>`;
    return `${crumb()}${head}${grid(list)}`;
  }

  /* ---------- 详情 ---------- */
  function albumPage(id){
    const a=ALBUMS.find(x=>x.id===id); if(!a) return notFound();
    const e=eraMap[a.era]||{};
    const links=listenLinks(a).map(l=>`<a class="btn play ${l.k}" href="${l.u}" target="_blank" rel="noopener">${l.n} ↗</a>`).join("");
    const tag=(label,val,href)=> val?`<dt>${label}</dt><dd>${href?`<a href="${href}">${esc(val)}</a>`:esc(val)}</dd>`:"";
    const tagLinks=(arr,kind)=>arr.map(v=>`<a href="#/${kind}/${enc(v)}">${esc(v)}</a>`).join("");
    const related=ALBUMS.filter(x=>x.id!==a.id &&
      (x.era===a.era || x.artist===a.artist || x.genres.some(g=>a.genres.includes(g))))
      .sort((x,y)=> (y.artist===a.artist?1:0)-(x.artist===a.artist?1:0))
      .slice(0,6);
    return `${crumb()}
    <div class="detail">
      <div>${coverHTML(a,true)}
        <div class="btn-row" style="margin-top:1rem">${links}</div>
        <p class="muted" style="font-size:.74rem;margin-top:.6rem">试听跳转至各平台搜索；本站不托管音频，封面来自 iTunes（失败时回退为程序化视觉）。</p>
      </div>
      <div>
        <div class="d-album-kicker">${esc(a.label)} · ${a.year}</div>
        <h1>${esc(a.title.replace(/^[^:]+:\s*/,""))}</h1>
        <div class="d-artist">${esc(a.artist)}</div>
        <div class="tags">${tagLinks(a.genres,"genre")}</div>
        <dl class="facts">
          ${tag("艺术家",a.artist,`#/artist/${enc(a.artist)}`)}
          ${tag("发行年份",a.year)}
          ${tag("唱片公司",a.label)}
          ${tag("所属时期",e.name,`#/era/${a.era}`)}
        </dl>
        <div class="tags"><span class="muted" style="font-family:var(--label);font-size:.78rem;align-self:center">乐器：</span>${tagLinks(a.instruments,"instrument")}</div>
        <div class="tags"><span class="muted" style="font-family:var(--label);font-size:.78rem;align-self:center">心情：</span>${tagLinks(a.moods,"mood")}</div>
        <div class="reason"><h4>导读 · 为什么值得听</h4>${esc(a.reason)}</div>
      </div>
    </div>
    <div class="related section">
      <h4>延伸聆听 · 同年代 / 同艺术家 / 同流派</h4>
      <div class="grid cols">${related.map(albumCard).join("")}</div>
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
      case "album": case "song": html=albumPage(parts[1]);break;
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
