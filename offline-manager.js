(function(){
  "use strict";

  var META_KEY = "waitingGamesOfflineMetaV1";
  var MANIFEST_URL = "offline-manifest.json";
  var els = {};
  var manifest = null;
  var swReady = false;
  var activeRequest = null;

  function $(id){return document.getElementById(id)}
  function setStatus(text){if(els.status)els.status.textContent=text}
  function setProgress(done,total){
    var pct = total ? Math.round(done / total * 100) : 0;
    if(els.progress)els.progress.style.width = pct + "%";
  }
  function onlineText(){return navigator.onLine ? "ONLINE" : "OFFLINE"}
  function loadMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||"{}")||{}}catch(e){return {}}}
  function saveMeta(meta){try{localStorage.setItem(META_KEY,JSON.stringify(meta))}catch(e){}}
  function itemFiles(item){return [item.url].concat(item.files||[])}
  function allFiles(m){
    var files = (m.core||[]).slice();
    (m.items||[]).forEach(function(item){files = files.concat(itemFiles(item))});
    return unique(files);
  }
  function unique(list){return Array.from(new Set(list))}
  function absolute(path){return new URL(path, location.href).href}
  function normalizePath(path){
    var url = new URL(path, location.href);
    url.hash = "";
    return url.href;
  }
  async function cacheHas(path){
    if(!("caches" in window))return false;
    return !!(await caches.match(normalizePath(path)));
  }
  async function itemSaved(item){
    var files = unique(itemFiles(item));
    for(var i=0;i<files.length;i++){
      if(!(await cacheHas(files[i])))return false;
    }
    return true;
  }
  function itemMeta(id){return loadMeta().items && loadMeta().items[id]}
  function updateOnlineState(){if(els.online)els.online.textContent=onlineText()}

  async function loadManifest(options){
    var url = MANIFEST_URL + (options&&options.fresh ? "?t=" + Date.now() : "");
    var res = await fetch(url, { cache: options&&options.fresh ? "no-store" : "default" });
    if(!res.ok)throw new Error("offline-manifest.jsonを取得できませんでした");
    manifest = await res.json();
    return manifest;
  }

  async function renderList(){
    if(!els.list || !manifest)return;
    var meta = loadMeta();
    els.list.innerHTML = "";
    for(var i=0;i<(manifest.items||[]).length;i++){
      var item = manifest.items[i];
      var saved = await itemSaved(item);
      var savedVersion = meta.items && meta.items[item.id] && meta.items[item.id].version;
      var update = saved && savedVersion && savedVersion !== item.version;
      var row = document.createElement("div");
      row.className = "offline-row " + (update ? "update" : saved ? "saved" : "");
      row.innerHTML = '<div><div class="offline-name"></div><div class="offline-state"></div></div><button type="button"></button>';
      row.querySelector(".offline-name").textContent = item.title;
      row.querySelector(".offline-state").textContent = update ? "更新あり / 保存済み " + savedVersion + " → " + item.version : saved ? "保存済み / " + (savedVersion || item.version) : "未保存 / " + item.version;
      var btn = row.querySelector("button");
      btn.textContent = saved ? "更新" : "保存";
      btn.addEventListener("click", downloadItem.bind(null,item));
      els.list.appendChild(row);
    }
  }

  function markDownloaded(items){
    var meta = loadMeta();
    meta.manifestVersion = manifest.version;
    meta.savedAt = new Date().toISOString();
    meta.items = meta.items || {};
    items.forEach(function(item){
      meta.items[item.id] = { version:item.version, savedAt:meta.savedAt };
    });
    saveMeta(meta);
  }

  function sendCacheRequest(urls){
    return new Promise(function(resolve,reject){
      if(!navigator.serviceWorker.controller){
        reject(new Error("Service Workerの準備がまだ完了していません。ページを再読み込みしてから再試行してください。"));
        return;
      }
      var requestId = "cache-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      activeRequest = { id:requestId, resolve:resolve, reject:reject };
      navigator.serviceWorker.controller.postMessage({ type:"CACHE_URLS", requestId:requestId, urls:urls.map(absolute) });
    });
  }

  async function downloadItems(items,label){
    if(!navigator.onLine){
      setStatus("オフライン中です。新規保存・更新にはWi-Fi接続が必要です。");
      return;
    }
    if(!swReady){
      setStatus("Service Workerを準備中です。数秒後に再試行してください。");
      return;
    }
    var files = unique((manifest.core||[]).concat(items.reduce(function(acc,item){return acc.concat(itemFiles(item))},[])));
    setProgress(0,files.length);
    setStatus((label||"保存") + "を開始します。0 / " + files.length);
    toggleButtons(true);
    try{
      await sendCacheRequest(files);
      markDownloaded(items);
      setProgress(files.length,files.length);
      setStatus((label||"保存") + "が完了しました。保存済みファイル " + files.length + " / " + files.length);
      await renderList();
    }catch(error){
      setStatus("保存に失敗しました: " + (error.message || error));
    }finally{
      activeRequest = null;
      toggleButtons(false);
    }
  }

  function toggleButtons(disabled){
    [els.downloadAll,els.checkUpdates,els.updateAll,els.refresh].forEach(function(btn){if(btn)btn.disabled=disabled});
    if(els.list)Array.prototype.forEach.call(els.list.querySelectorAll("button"),function(btn){btn.disabled=disabled});
  }

  function downloadAll(){downloadItems(manifest.items||[],"一括ダウンロード")}
  function downloadItem(item){downloadItems([item],item.title + "の保存")}

  async function checkUpdates(){
    if(!navigator.onLine){
      setStatus("オフライン中です。保存済みゲームは開けますが、更新確認はWi-Fi接続中に実行してください。");
      await renderList();
      return;
    }
    try{
      await loadManifest({fresh:true});
      var meta = loadMeta();
      var changed = !meta.manifestVersion || meta.manifestVersion !== manifest.version;
      setStatus(changed ? "更新候補があります。必要なら一括更新を実行してください。" : "更新は見つかりませんでした。");
      await renderList();
    }catch(error){
      setStatus("更新確認に失敗しました: " + (error.message || error));
    }
  }

  function updateAll(){downloadItems(manifest.items||[],"一括更新")}

  async function refresh(){
    updateOnlineState();
    if(!manifest){
      try{await loadManifest({fresh:navigator.onLine})}catch(e){try{await loadManifest()}catch(err){}}
    }
    await renderList();
    if(manifest)setStatus(navigator.onLine ? "オンラインです。保存・更新を実行できます。" : "オフラインです。保存済みの項目を起動できます。");
  }

  async function interceptPlay(event){
    var btn = event.target.closest && event.target.closest(".play");
    if(!btn || navigator.onLine)return;
    var url = btn.getAttribute("data-url");
    if(!url)return;
    event.preventDefault();
    event.stopPropagation();
    if(await cacheHas(url)){
      location.href = url;
      return;
    }
    setStatus("この項目はまだオフライン保存されていません。Wi-Fi接続中にOFFLINEから保存してください。");
    var modal = $("modal"), title = $("modalTitle"), text = $("modalText");
    if(modal && title && text){
      title.textContent = "オフライン未保存";
      text.textContent = "このゲームはまだ端末に保存されていません。Wi-Fiに接続して「OFFLINE」から保存してください。";
      modal.classList.add("show");
    }
  }

  function bindMessages(){
    if(!("serviceWorker" in navigator))return;
    navigator.serviceWorker.addEventListener("message",function(event){
      var data = event.data || {};
      if(data.type === "CACHE_PROGRESS"){
        setProgress(data.done,data.total);
        setStatus("保存中: " + data.done + " / " + data.total);
      }
      if(activeRequest && data.requestId === activeRequest.id && data.type === "CACHE_DONE"){
        activeRequest.resolve(data);
      }
      if(activeRequest && data.requestId === activeRequest.id && data.type === "CACHE_ERROR"){
        activeRequest.reject(new Error(data.message || "保存に失敗しました"));
      }
    });
  }

  async function registerServiceWorker(){
    if(!("serviceWorker" in navigator)){
      setStatus("このブラウザはService Workerに対応していません。");
      return;
    }
    try{
      var registration = await navigator.serviceWorker.register("service-worker.js", { scope:"./" });
      await navigator.serviceWorker.ready;
      swReady = true;
      if(!navigator.serviceWorker.controller){
        setStatus("Service Workerを有効化しました。オフライン保存前に一度ページを再読み込みしてください。");
      }else{
        setStatus("Service Workerの準備が完了しました。");
      }
      if(registration.waiting){
        registration.waiting.postMessage({type:"SKIP_WAITING"});
      }
    }catch(error){
      setStatus("Service Workerの登録に失敗しました: " + (error.message || error));
    }
  }

  async function init(){
    els = {
      online:$("offlineOnlineState"),
      list:$("offlineList"),
      status:$("offlineStatus"),
      progress:$("offlineProgressBar"),
      downloadAll:$("offlineDownloadAll"),
      checkUpdates:$("offlineCheckUpdates"),
      updateAll:$("offlineUpdateAll"),
      refresh:$("offlineRefresh")
    };
    if(!els.status)return;
    updateOnlineState();
    window.addEventListener("online",refresh);
    window.addEventListener("offline",refresh);
    document.addEventListener("click",interceptPlay,true);
    bindMessages();
    els.downloadAll && els.downloadAll.addEventListener("click",downloadAll);
    els.checkUpdates && els.checkUpdates.addEventListener("click",checkUpdates);
    els.updateAll && els.updateAll.addEventListener("click",updateAll);
    els.refresh && els.refresh.addEventListener("click",refresh);
    try{
      await loadManifest({fresh:navigator.onLine});
      await renderList();
    }catch(error){
      setStatus("オフライン情報の読み込みに失敗しました: " + (error.message || error));
    }
    await registerServiceWorker();
    await refresh();
  }

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
