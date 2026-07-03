/* 1001 Jazz — 单页应用，hash 路由，纯前端渲染。以「专辑」为单位。 */
(function(){
  "use strict";
  const ALBUMS = window.ALBUMS, ERAS = window.ERAS;
  const BIOS = window.ARTIST_BIOS || {};
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
      const L = listenLinks(a), yt=L.find(x=>x.k==="youtube"), sp=L.find(x=>x.k==="spotify"), ne=L.find(x=>x.k==="netease");
      overlay = `<div class="c-play">
        <a class="cp-btn cp-ne" href="${ne.u}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="在网易云音乐播放" aria-label="在网易云音乐播放">${ne.ic}</a>
        <a class="cp-btn cp-sp" href="${sp.u}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="在 Spotify 播放" aria-label="在 Spotify 播放">${PLAY_ICONS.spotify}</a>
        <a class="cp-btn cp-yt" href="${yt.u}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="在 YouTube 播放" aria-label="在 YouTube 播放">${PLAY_ICONS.youtube}</a>
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

  /* ---------- 艺术家肖像：维基百科 pageimages（JSONP + localStorage 缓存，失败回退字母徽章） ---------- */
  // 与封面同理：不托管图片，客户端按需取公共接口缩略图。仅个人词条拉肖像（乐队/合作保留徽章）。
  const portraitCache = {};
  function applyPortrait(imgEl,medalEl,url){
    if(!url||!imgEl) return;
    const show=()=>{ imgEl.classList.add("loaded"); if(medalEl) medalEl.classList.add("has-photo"); };
    imgEl.addEventListener("load",show);
    imgEl.src=url;
    if(imgEl.complete && imgEl.naturalWidth) show(); // 已缓存时 load 事件可能不再触发
  }
  function loadPortrait(name,imgEl,medalEl){
    if(!imgEl) return;
    if(name in portraitCache){ applyPortrait(imgEl,medalEl,portraitCache[name]); return; }
    const key="art2:"+name, cached=lsGet(key);
    if(cached!==null){ portraitCache[name]=cached; applyPortrait(imgEl,medalEl,cached); return; }
    const title=wikiTitle(name);
    const cbName="__wkcb"+(jsonpSeq++);
    const sc=document.createElement("script");
    let done=false;
    // persist=true 仅在 API 成功返回时（含确实无图 ""）才写缓存；网络错误/超时不缓存，下次重试
    const finish=(url,persist)=>{ if(done)return; done=true; try{delete window[cbName];}catch(e){} sc.remove();
      if(persist){ portraitCache[name]=url; lsSet(key,url); } applyPortrait(imgEl,medalEl,url); };
    window[cbName]=data=>{ let url=""; try{ const ps=data.query.pages, p=ps[Object.keys(ps)[0]];
      if(p&&p.thumbnail&&p.thumbnail.source) url=p.thumbnail.source; }catch(e){} finish(url,true); };
    sc.onerror=()=>finish("",false);
    sc.src=`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=320&redirects=1&titles=${enc(title)}&callback=${cbName}`;
    document.body.appendChild(sc);
    setTimeout(()=>finish("",false),8000);
  }
  // 批量：索引页数百个肖像合并成少量维基请求（每次 ≤40 标题），显著减少请求数
  let portraitQueue=[], portraitTimer=null;
  function wikiTitle(name){ return (BIOS[name]&&BIOS[name].wiki)||name; }
  function queuePortrait(name,imgEl,medalEl){
    if(!imgEl) return;
    if(name in portraitCache){ applyPortrait(imgEl,medalEl,portraitCache[name]); return; }
    const cached=lsGet("art2:"+name);
    if(cached!==null){ portraitCache[name]=cached; applyPortrait(imgEl,medalEl,cached); return; }
    portraitQueue.push({name,title:wikiTitle(name),imgEl,medalEl});
    if(portraitQueue.length>=40) flushPortraitQueue();
    else if(!portraitTimer) portraitTimer=setTimeout(flushPortraitQueue,150);
  }
  function flushPortraitQueue(){
    if(portraitTimer){ clearTimeout(portraitTimer); portraitTimer=null; }
    const batch=portraitQueue.splice(0,40);
    if(!batch.length) return;
    const titles=[...new Set(batch.map(b=>b.title))];
    const cbName="__wkbat"+(jsonpSeq++);
    const sc=document.createElement("script");
    let done=false;
    // persist=true 仅在 API 成功返回时才写缓存；网络错误/超时不缓存，下次重试
    const finish=(map,persist)=>{ if(done)return; done=true; try{delete window[cbName];}catch(e){} sc.remove();
      batch.forEach(it=>{ const url=map[it.title]||""; if(persist){ portraitCache[it.name]=url; lsSet("art2:"+it.name,url); } applyPortrait(it.imgEl,it.medalEl,url); }); };
    window[cbName]=data=>{
      const map={};
      try{
        const q=data.query||{};
        const norm={}; (q.normalized||[]).forEach(x=>norm[x.from]=x.to);
        const redir={}; (q.redirects||[]).forEach(x=>redir[x.from]=x.to);
        const resolve=t=>{ let cur=norm[t]||t,n=0; while(redir[cur]&&n++<6) cur=redir[cur]; return cur; };
        const byTitle={}, pages=q.pages||{};
        Object.keys(pages).forEach(k=>{ const p=pages[k]; if(p.title) byTitle[p.title]=p; });
        titles.forEach(t=>{ const p=byTitle[resolve(t)]; map[t]=(p&&p.thumbnail&&p.thumbnail.source)||""; });
      }catch(e){}
      finish(map,true);
    };
    sc.onerror=()=>finish({},false);
    sc.src=`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=320&pilimit=50&redirects=1&titles=${titles.map(enc).join("%7C")}&callback=${cbName}`;
    document.body.appendChild(sc);
    setTimeout(()=>finish({},false),9000);
  }
  // 视口懒加载：仅当徽章进入视口附近才入队（人物索引页有数百个，避免一次性发出）
  let portraitObserver=null;
  function ensurePortraitObserver(){
    if(portraitObserver||typeof IntersectionObserver==="undefined") return portraitObserver;
    portraitObserver=new IntersectionObserver((entries,obs)=>{
      entries.forEach(en=>{
        if(!en.isIntersecting) return;
        const el=en.target, img=el.querySelector("img");
        obs.unobserve(el);
        if(img && !img.src) queuePortrait(el.getAttribute("data-portrait"),img,el);
      });
    },{rootMargin:"250px"});
    return portraitObserver;
  }
  // 人物索引页内即时筛选（按原名 / 译名过滤，实时计数）
  function hydrateArtistFilter(){
    const inp=document.getElementById("artistFilter"); if(!inp) return;
    const grid=document.getElementById("artistGrid"); if(!grid) return;
    const tiles=[...grid.querySelectorAll(".tile")];
    const shownEl=document.getElementById("artistShown"), emptyEl=document.getElementById("artistEmpty");
    inp.addEventListener("input",()=>{
      const q=inp.value.trim().toLowerCase();
      let shown=0;
      tiles.forEach(t=>{
        const ok=!q || t.getAttribute("data-search").indexOf(q)>=0;
        t.style.display=ok?"":"none"; if(ok) shown++;
      });
      if(shownEl) shownEl.textContent=shown;
      if(emptyEl) emptyEl.style.display=shown?"none":"";
    });
  }
  function hydratePortraits(){
    // 少量、在视口附近的（人物页小传卡、首页精选）即时加载
    document.querySelectorAll(".ah-medal[data-portrait],.fa-medal[data-portrait]").forEach(el=>{
      const img=el.querySelector("img");
      if(img && !img.src) loadPortrait(el.getAttribute("data-portrait"),img,el);
    });
    // 大量（人物索引数百个）视口懒加载，避免一次性请求
    const obs=ensurePortraitObserver();
    document.querySelectorAll(".tile-medal[data-portrait]").forEach(el=>{
      const img=el.querySelector("img");
      if(!img||img.src) return;
      if(obs) obs.observe(el);
      else loadPortrait(el.getAttribute("data-portrait"),img,el);
    });
  }

  const PLATFORMS = {
    netease:{n:"网易云音乐",color:"#c20c0c",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 18h-12a4 4 0 01-.7-7.93 5.5 5.5 0 0110.85-1.06A3.75 3.75 0 0118.5 18z"/></svg>'},
    qq:{n:"QQ音乐",color:"#1bce6b",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 4v9.4a3 3 0 11-2-2.83V8l-4 1v6.4a3 3 0 11-2-2.83V6l8-2z"/></svg>'},
    spotify:{n:"Spotify",color:"#1db954",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.6 14.4a.62.62 0 01-.86.21c-2.35-1.44-5.31-1.76-8.79-.96a.63.63 0 11-.28-1.22c3.81-.87 7.08-.5 9.72 1.11a.62.62 0 01.21.86zm1.22-2.72a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 11-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.37.23.49.71.25 1.07zm.11-2.84C14.8 8.93 9.5 8.74 6.42 9.67a.93.93 0 11-.54-1.79c3.53-1.07 9.38-.86 13.08 1.34a.94.94 0 01-.96 1.6z"/></svg>'},
    apple:{n:"Apple Music",color:"#fa233b",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.7A10.3 10.3 0 1012 22.3 10.3 10.3 0 0012 1.7zm4 5.1v6.7a2.2 2.2 0 11-1.3-2V9.2l-4.2.9v4.9a2.2 2.2 0 11-1.3-2V8.1L16 6.8z"/></svg>'},
    youtube:{n:"YouTube",color:"#ff0000",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.8-.5-5.6c-.27-1-1.05-1.8-2.04-2.07C18.7 4 12 4 12 4s-6.7 0-8.46.33c-.99.27-1.77 1.07-2.04 2.07C1 8.2 1 12 1 12s0 3.8.5 5.6c.27 1 1.05 1.8 2.04 2.07C5.3 20 12 20 12 20s6.7 0 8.46-.33c.99-.27 1.77-1.07 2.04-2.07C23 15.8 23 12 23 12zM9.75 15.5v-7L16 12l-6.25 3.5z"/></svg>'},
    bandcamp:{n:"Bandcamp",color:"#1da0c3",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 16.5l4.7-9H21.5l-4.7 9H2.5z"/></svg>'},
    douban:{n:"豆瓣",color:"#2e963b",ic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4.5h18v2.6H3zM3 17.4h18V20H3zM6.4 9h11.2l-1.5 6H7.9z"/></svg>'}
  };

  function listenLinks(a){
    const q = enc(`${a.artist} ${a.title.replace(/^[^:]+:\s*/,"")}`);
    const U = {
      netease:`https://music.163.com/#/search/m/?s=${q}&type=10`,
      qq:`https://y.qq.com/n/ryqq/search?w=${q}&t=album`,
      spotify:`https://open.spotify.com/search/${q}`,
      apple:`https://music.apple.com/search?term=${q}`,
      youtube:`https://www.youtube.com/results?search_query=${q}`,
      bandcamp:`https://bandcamp.com/search?q=${q}`,
      douban:`https://search.douban.com/music/subject_search?search_text=${q}`
    };
    return ["netease","qq","spotify","apple","youtube","bandcamp","douban"]
      .map(k=>({k,u:U[k],n:PLATFORMS[k].n,color:PLATFORMS[k].color,ic:PLATFORMS[k].ic}));
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
  // 精选艺术家模块：FEATURED_ARTISTS 人物卡（徽章+译名+生卒+作品数）
  function featuredArtistsModule(){
    const feat=(window.FEATURED_ARTISTS||[]).filter(n=>ALBUMS.some(a=>a.artist===n));
    if(!feat.length) return "";
    const cards=feat.map(name=>{
      const b=BIOS[name], n=ALBUMS.filter(a=>a.artist===name).length, ls=b?lifeStr(b):"";
      const person=b&&b.born; // 仅个人拉肖像
      return `<div class="fa-card" onclick="location.hash='#/artist/${enc(name)}'" role="button" tabindex="0" aria-label="${esc(b?b.zh:name)}">
        <div class="fa-medal"${person?` data-portrait="${esc(name)}"`:""}>
          <span class="fa-mono">${esc(initials(name))}</span>
          ${person?`<img class="fa-photo" alt="${esc(b.zh||name)} 肖像">`:""}
        </div>
        <div class="fa-zh">${esc(b?b.zh:name)}</div>
        <div class="fa-en">${esc(name)}</div>
        <div class="fa-n">${n} 张${ls?` · ${esc(ls)}`:""}</div>
      </div>`;
    }).join("");
    return `<section class="section">
      <div class="section-head"><h2>精选艺术家</h2><span class="tag">Featured · ${feat.length} 位</span></div>
      <div class="fa-grid">${cards}</div>
    </section>`;
  }
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
      <p class="lead">按年代、流派、人物、心情与乐器进入爵士乐史。每张专辑旁边，是一段中文导读。</p>
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
          <div class="t-artist">${esc(pick.artist)}${(BIOS[pick.artist]&&BIOS[pick.artist].zh)?`（${esc(BIOS[pick.artist].zh)}）`:""} · ${pick.year} · ${esc(pick.label)}</div>
          <p>${esc(pick.reason)}</p>
          <a class="btn solid" href="#/album/${pick.id}">查看详情与试听 →</a>
        </div>
      </div>
    </section>

    ${featuredArtistsModule()}

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
  // 生卒 / 活跃年展示串：乐队用 life，在世者用「生于」，其余用「生–卒」
  function lifeStr(b){
    if(!b) return "";
    if(b.life) return b.life;
    if(b.born && b.died) return b.born+"–"+b.died;
    if(b.born) return "生于 "+b.born;
    return "";
  }
  // 由英文名取首字母作徽章（乐队/带 & 的名字也能优雅处理）
  function initials(name){
    const parts=String(name).replace(/&/g," ").split(/\s+/).filter(Boolean);
    const s=parts.slice(0,2).map(p=>p[0]).join("");
    return (s||"♪").toUpperCase();
  }
  // 小传卡：无词条时返回空串（优雅降级）
  function artistHero(name){
    const b=BIOS[name]; if(!b) return "";
    const meta=[lifeStr(b),b.country,b.role].filter(Boolean).join("　·　");
    const person=!!b.born; // 仅个人拉肖像；乐队/合作保留字母徽章
    return `<div class="artist-hero">
      <div class="ah-medal"${person?` data-portrait="${esc(name)}"`:""}>
        <span class="ah-mono">${esc(initials(name))}</span>
        ${person?`<img class="ah-photo" alt="${esc(b.zh||name)} 肖像">`:""}
      </div>
      <div class="ah-body">
        <div class="ah-zh">${esc(b.zh||name)}</div>
        <div class="ah-en">${esc(name)}</div>
        ${meta?`<div class="ah-meta">${esc(meta)}</div>`:""}
        <p class="ah-bio">${esc(b.bio)}</p>
        <div class="ah-src">肖像来自维基百科（Wikipedia）</div>
      </div>
    </div>`;
  }
  function artistsPage(){
    const m={};ALBUMS.forEach(a=>m[a.artist]=(m[a.artist]||0)+1);
    const feat=(window.FEATURED_ARTISTS||[]);
    const ordered=Object.keys(m).sort((a,b)=>{
      const fa=feat.indexOf(a),fb=feat.indexOf(b);
      if(fa>=0&&fb>=0)return fa-fb; if(fa>=0)return -1; if(fb>=0)return 1; return a.localeCompare(b);
    });
    const bioN=ordered.filter(a=>BIOS[a]).length;
    const tiles=ordered.map(a=>{
      const b=BIOS[a], ls=b?lifeStr(b):"", person=b&&b.born;
      const search=(a+" "+(b?b.zh:"")).toLowerCase();
      return `<div class="tile${b?" has-bio":""}" data-search="${esc(search)}" onclick="location.hash='#/artist/${enc(a)}'">
        <div class="tile-head">
          <div class="tile-medal"${person?` data-portrait="${esc(a)}"`:""}>
            <span class="tm-mono">${esc(initials(a))}</span>
            ${person?`<img class="tm-photo" alt="${esc(b.zh||a)} 肖像">`:""}
          </div>
          <div class="tile-head-txt">
            <div class="t-k">ARTIST${b?'<span class="bio-badge">小传</span>':""}</div>
            <h3>${esc(a)}</h3>
          </div>
        </div>
        ${b?`<div class="t-zh">${esc(b.zh)}${ls?` · ${esc(ls)}`:""}</div>`:""}
        <div class="cnt">${m[a]} 张 →</div></div>`;
    }).join("");
    return `${crumb()}<div class="section-head"><h2>按人物进入</h2><span class="tag">${ordered.length} 位 · ${bioN} 篇小传</span></div>
      <div class="artist-filter-bar">
        <input id="artistFilter" type="search" placeholder="筛选艺术家 / 译名…" autocomplete="off" aria-label="筛选艺术家">
        <span class="aff-count"><b id="artistShown">${ordered.length}</b> / ${ordered.length} 位</span>
      </div>
      <div class="tile-grid" id="artistGrid">${tiles}</div>
      <p class="empty" id="artistEmpty" style="display:none">没有匹配的艺术家。</p>`;
  }
  function artistPage(a){
    const list=ALBUMS.filter(x=>x.artist===a).sort((x,y)=>x.year-y.year);
    if(!list.length) return notFound();
    const b=BIOS[a];
    // 作品按 ERAS 顺序分组成 discography 时间线；只横跨单一时期时退回平铺网格
    const groups=ERAS.map(e=>({e,items:list.filter(x=>x.era===e.key)})).filter(g=>g.items.length);
    const grouped=groups.length>1;
    const head=b
      ? `<div class="section-head"><h2>全部作品</h2><span class="tag">${list.length} albums · ${grouped?"按时期":"按年份"}</span></div>`
      : `<div class="section-head"><h2>${esc(a)}</h2><span class="tag">${list.length} albums · ${grouped?"按时期":"按年份"}</span></div>`;
    const body=grouped
      ? groups.map(g=>`<div class="disc-era">
          <div class="disc-era-head"><span class="de-yr">${esc(g.e.years)}</span><span class="de-nm">${esc(g.e.name.split(" / ")[0])}</span><span class="de-n">${g.items.length} 张</span></div>
          <div class="grid cols">${g.items.map(albumCard).join("")}</div>
        </div>`).join("")
      : grid(list);
    return `${crumb()}${artistHero(a)}${head}${body}`;
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
      list=ALBUMS.filter(a=>(a.title+a.artist+a.label+a.genres.join(" ")+(eraMap[a.era]||{}).name+" "+((BIOS[a.artist]||{}).zh||""))
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
    const links=listenLinks(a).map(l=>`<a class="lbtn ${l.k}" href="${l.u}" target="_blank" rel="noopener" style="--bc:${l.color}"><span class="lbtn-ic">${l.ic}</span><span class="lbtn-n">${esc(l.n)}</span></a>`).join("");
    const tag=(label,val,href)=> val?`<dt>${label}</dt><dd>${href?`<a href="${href}">${esc(val)}</a>`:esc(val)}</dd>`:"";
    const tagLinks=(arr,kind)=>arr.map(v=>`<a href="#/${kind}/${enc(v)}">${esc(v)}</a>`).join("");
    const related=ALBUMS.filter(x=>x.id!==a.id &&
      (x.era===a.era || x.artist===a.artist || x.genres.some(g=>a.genres.includes(g))))
      .sort((x,y)=> (y.artist===a.artist?1:0)-(x.artist===a.artist?1:0))
      .slice(0,6);
    return `${crumb()}
    <div class="detail">
      <div>${coverHTML(a,true)}
        <div class="listen"><div class="listen-label">在平台收听 · Listen on</div><div class="listen-grid">${links}</div></div>
        <p class="muted" style="font-size:.74rem;margin-top:.6rem">试听跳转至各平台搜索；本站不托管音频，封面来自 iTunes（失败时回退为程序化视觉）。</p>
      </div>
      <div>
        <div class="d-album-kicker">${esc(a.label)} · ${a.year}</div>
        <h1>${esc(a.title.replace(/^[^:]+:\s*/,""))}</h1>
        <div class="d-artist"><a href="#/artist/${enc(a.artist)}">${esc(a.artist)}</a>${(BIOS[a.artist]&&BIOS[a.artist].zh)?`<span class="d-artist-zh">${esc(BIOS[a.artist].zh)}</span>`:""}</div>
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

  /* ---------- 关于 ---------- */
  function aboutPage(){
    const albumN=ALBUMS.length, eraN=ERAS.length,
      artistN=new Set(ALBUMS.map(a=>a.artist)).size,
      genreN=new Set(ALBUMS.flatMap(a=>a.genres)).size;
    return `${crumb()}
    <div class="about">
      <header class="about-hero">
        <div class="kicker">About · 关于本站</div>
        <h1>一千零一张爵士必听专辑地图</h1>
        <p class="lead">从新奥尔良到伦敦，从 78 转唱片到流媒体——一座可听、可看、可读的爵士乐地图。每张专辑旁边，是一段告诉你"它为什么重要、该从哪听起"的中文导读。</p>
        <div class="about-stats">
          <div><b>${albumN}</b><span>张专辑</span></div>
          <div><b>${eraN}</b><span>历史时期</span></div>
          <div><b>${artistN}</b><span>位艺术家</span></div>
          <div><b>${genreN}</b><span>个流派</span></div>
        </div>
      </header>

      <section class="about-sec">
        <h2>这是什么</h2>
        <p>1001 Jazz 是一个爵士乐<strong>策展</strong>项目，不是播放器。它把爵士乐史里的 1001 张关键专辑整理成一张可检索的地图，每张配中文导读、年代、流派、乐器与心情标签，帮你找到下一张该听的唱片。</p>
      </section>

      <section class="about-sec">
        <h2>怎么逛</h2>
        <p>顶部导航提供多个入口：<a href="#/eras">按年代</a>（13 个历史时期，从拉格泰姆到全球新爵士）、<a href="#/genres">按流派</a>、<a href="#/artists">按人物</a>、<a href="#/moods">按心情</a>、<a href="#/instruments">按乐器</a>，以及<a href="#/all">全部专辑</a>的全库搜索。每张专辑详情页还会推荐同年代 / 同艺术家 / 同流派的延伸聆听。</p>
      </section>

      <section class="about-sec">
        <h2>艺术家小传</h2>
        <p>点进任一<a href="#/artists">人物</a>，页首是一张中文小传卡：译名、生卒 / 活跃年、国别、主奏乐器，以及一句"为什么重要"，配一张来自维基百科的肖像；下方把这位艺术家的作品<strong>按历史时期分组</strong>，形成一条聆听时间线。全站共收录 <strong>${artistN}</strong> 位艺术家的小传，覆盖全部 ${albumN} 张专辑。人物索引页支持按原名或中文译名<strong>即时筛选</strong>，全库搜索也认中文译名（搜"迈尔斯""柯川"即可）。乐队与合作条目回退为字母徽章。</p>
      </section>

      <section class="about-sec legal">
        <h2>合法性原则</h2>
        <p>本站<strong>不上传、不缓存、不下载、不托管任何音乐文件</strong>。"试听"按钮一律跳转到 Spotify / Apple Music / YouTube / Bandcamp / 豆瓣 的搜索页，由各平台合法播放。专辑封面取自 iTunes 公共接口，艺术家肖像取自<strong>维基百科 / 维基共享资源（Wikimedia Commons）</strong>公共接口——二者均由客户端按需请求、本地 localStorage 缓存，加载失败时回退为程序化视觉占位或字母徽章。全部文字导读与小传为入门向介绍，仅供学习交流。</p>
      </section>

      <section class="about-sec">
        <h2>技术栈</h2>
        <p>纯静态单页网站，零构建、零后端、零第三方依赖：<code>index.html</code> 负责骨架与导航，<code>styles.css</code> 是暗色复古爵士视觉，<code>app.js</code> 实现 hash 路由、渲染、搜索与懒加载，<code>data.js</code> 存放 1001 张专辑数据，<code>artists.js</code> 存放艺术家小传（<code>window.ARTIST_BIOS</code>）。专辑封面来自 iTunes Search API、艺术家肖像来自 Wikipedia pageimages，均用 IntersectionObserver 视口内才请求、并本地 localStorage 缓存；索引页的肖像还会合并成批量请求以减少往返。可一键部署到 GitHub Pages / Vercel / Cloudflare Pages。</p>
      </section>

      <section class="about-sec dev">
        <h2>开发者</h2>
        <p>由 <strong>xujiann</strong> 设计与开发。问题反馈、纠错或建议，欢迎来信：<a href="mailto:popstudy@gmail.com">popstudy@gmail.com</a>。</p>
      </section>
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
      case "about": html=aboutPage();break;
      case "search":{const m=/q=([^&]*)/.exec(query||"");html=allPage(m?decodeURIComponent(m[1]):"");break;}
      default: html=notFound();
    }
    app.innerHTML=html;
    window.scrollTo({top:0,behavior:"instant"});
    hydrateCovers();
    hydratePortraits();
    hydrateArtistFilter();
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
