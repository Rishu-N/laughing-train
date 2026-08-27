// Self-contained HTML export — one .html file the recipient can open in
// any browser and get a real scrolling replica of the chat, media
// embedded as base64 data URIs. No virtualization library is available
// inside a static file, so this renders in batches (an
// IntersectionObserver sentinel loads the next ~150 rows as the reader
// nears the bottom) rather than measuring/recycling DOM nodes — simpler
// and more portable, and the export is already scoped to whatever range
// the user filtered to before sharing.
import { Flag, MsgType, type ChatModel } from "../model";
import { checkCancelled, downloadBlob, safeFileStem, type CancelToken } from "./shared";

export interface HtmlExportParams {
  model: ChatModel;
  start: number;
  end: number;
  meId: number;
  contactName: string;
  mediaBlobs: Map<string, Blob>;
  showTimestamps: boolean;
  showSenderName: boolean;
  showSystem?: boolean;
  onProgress?: (done: number, total: number) => void;
  cancelToken?: CancelToken;
}

const BASE64_INFLATION = 4 / 3;

/** Rough size estimate so the export dialog can warn before the user
 * commits to a large export — exact only up to base64/JSON overhead. */
export function estimateHtmlSize(
  model: ChatModel,
  start: number,
  end: number,
  mediaBlobs: Map<string, Blob>,
): number {
  const seen = new Set<string>();
  let mediaBytes = 0;
  for (let i = start; i < end; i++) {
    if ((model.flags[i] & Flag.HAS_FILE) === 0) continue;
    const key = model.mediaKey[i];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const blob = mediaBlobs.get(key);
    if (blob) mediaBytes += blob.size;
  }
  const textBytes = (end - start) * 90;
  return Math.round(mediaBytes * BASE64_INFLATION) + textBytes + 20_000;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportHtml(params: HtmlExportParams): Promise<void> {
  const { model, start, end, meId, contactName, mediaBlobs, showTimestamps, showSenderName, showSystem, onProgress, cancelToken } =
    params;

  // The rows that actually make it into the file. Everything below reads from
  // this list rather than slicing the columns straight through, because the
  // "show system messages" switch punches holes in an otherwise contiguous
  // range — and the exported document is meant to be the one on screen.
  const indices: number[] = [];
  for (let i = start; i < end; i++) {
    if (showSystem === false && model.type[i] === MsgType.SYSTEM) continue;
    indices.push(i);
  }

  const mediaData: Record<string, string> = {};
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const i of indices) {
    if ((model.flags[i] & Flag.HAS_FILE) === 0) continue;
    const key = model.mediaKey[i];
    if (key && !seen.has(key) && mediaBlobs.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  let done = 0;
  for (const key of keys) {
    checkCancelled(cancelToken);
    mediaData[key] = await blobToDataUrl(mediaBlobs.get(key)!);
    done++;
    onProgress?.(done, Math.max(1, keys.length));
  }

  const dateRange =
    indices.length > 0
      ? `${new Date(model.ts[indices[0]]).toLocaleDateString()} – ${new Date(
          model.ts[indices[indices.length - 1]],
        ).toLocaleDateString()}`
      : "";

  const payload = {
    contactName,
    dateRange,
    meId,
    senders: model.senders,
    showTimestamps,
    showSenderName,
    ts: indices.map((i) => model.ts[i]),
    senderId: indices.map((i) => model.senderId[i]),
    type: indices.map((i) => model.type[i]),
    flags: indices.map((i) => model.flags[i]),
    bodies: indices.map((i) => model.bodies[i]),
    mediaKey: indices.map((i) => model.mediaKey[i]),
    media: mediaData,
  };

  const html = buildDocument(payload);
  downloadBlob(new Blob([html], { type: "text/html" }), `${safeFileStem(contactName)}.html`);
}

function buildDocument(payload: unknown): string {
  // `<` is escaped so a message body containing a literal "</script>"
  // can't break out of the embedded JSON and corrupt the page.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WhatsApp chat export</title>
<style>${STYLE}</style>
</head>
<body>
<div id="app">
  <header id="hdr"><div id="hdr-avatar"></div><div><div id="hdr-name"></div><div id="hdr-sub"></div></div></header>
  <div id="scroll"><div id="rows"></div><div id="sentinel"></div></div>
</div>
<script>window.__DATA__ = ${json};<\/script>
<script>${SCRIPT}<\/script>
</body>
</html>`;
}

const STYLE = `
:root{--chat-bg:#efeae2;--header-bg:#f0f2f5;--panel-bg:#fff;--bubble-in:#fff;--bubble-out:#d9fdd3;
--bubble-system:#fff2c7;--text-primary:#111b21;--text-secondary:#667781;--accent:#00a884;--danger:#e15252;}
@media (prefers-color-scheme:dark){:root{--chat-bg:#0b141a;--header-bg:#202c33;--panel-bg:#202c33;
--bubble-in:#202c33;--bubble-out:#005c4b;--bubble-system:#2a2f32;--text-primary:#e9edef;
--text-secondary:#8696a0;--accent:#06cf9c;}}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI","Helvetica Neue",system-ui,Arial,sans-serif;color:var(--text-primary);background:var(--chat-bg)}
#app{display:flex;flex-direction:column;height:100vh}
#hdr{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--header-bg);flex-shrink:0}
#hdr-avatar{width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600}
#hdr-name{font-weight:600;font-size:15px}
#hdr-sub{font-size:12px;color:var(--text-secondary)}
#scroll{flex:1;overflow-y:auto;padding:10px 6% 24px}
.date-divider{display:flex;justify-content:center;margin:10px 0}
.date-divider span{background:var(--panel-bg);color:var(--text-secondary);font-size:12.5px;padding:5px 12px;border-radius:8px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.row{display:flex;padding:0 2px}
.row.in{justify-content:flex-start}.row.out{justify-content:flex-end}
.gfirst{margin-top:6px}.grest{margin-top:1px}
.row-system{display:flex;justify-content:center;margin:8px 0}
.bubble-system{background:var(--bubble-system);color:var(--text-primary);font-size:12.5px;text-align:center;padding:6px 12px;border-radius:8px;max-width:80%}
.bubble{position:relative;max-width:min(65%,520px);padding:6px 8px 4px 9px;border-radius:8px;box-shadow:0 1px .5px rgba(0,0,0,.13);font-size:14.2px;line-height:19px;overflow-wrap:anywhere}
.bubble.in{background:var(--bubble-in)}.bubble.out{background:var(--bubble-out)}
.bubble-sender{font-size:13px;font-weight:600;margin-bottom:2px}
.bubble-text{white-space:pre-wrap}
.bubble-caption{padding:4px 2px 0;white-space:pre-wrap}
.bubble-meta{float:right;margin:4px -2px -2px 6px;font-size:11px;color:var(--text-secondary)}
.bubble.deleted{color:var(--text-secondary);font-style:italic}
.bubble.call{display:flex;align-items:center;gap:8px}
.call-icon.missed{color:var(--danger)}.call-icon{color:var(--accent)}
.media-placeholder{display:flex;align-items:center;gap:10px;padding:10px 4px;min-width:200px;color:var(--text-secondary);font-size:13px}
.media-placeholder-icon{width:40px;height:40px;border-radius:50%;background:rgba(134,150,160,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.media-image{display:block;max-width:320px;max-height:400px;border-radius:6px;object-fit:cover;cursor:pointer}
.media-sticker{width:128px;height:128px;object-fit:contain}
.sticker-wrap{display:flex;flex-direction:column;align-items:center;gap:2px}
.sticker-time{font-size:11px;color:var(--text-secondary);background:var(--panel-bg);padding:1px 6px;border-radius:6px}
a{color:var(--accent)}
#lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:50}
#lightbox img{max-width:92vw;max-height:92vh;border-radius:4px}
#lightbox.open{display:flex}
`;

const SCRIPT = `
(function(){
  var D = window.__DATA__;
  var T = {TEXT:0,IMAGE:1,VIDEO:2,STICKER:3,AUDIO:4,DOCUMENT:5,GIF:6,CONTACT:7,CALL:8,DELETED:9,SYSTEM:10};
  var F = {EDITED:1,MISSED:2,OMITTED:4,HAS_FILE:8};
  var MEDIA_TYPES = [T.IMAGE,T.VIDEO,T.STICKER,T.AUDIO,T.DOCUMENT,T.GIF,T.CONTACT];
  var PLACEHOLDER = {};
  PLACEHOLDER[T.IMAGE]=['📷','Photo not included in this export'];
  PLACEHOLDER[T.VIDEO]=['🎥','Video not included in this export'];
  PLACEHOLDER[T.STICKER]=['🎭','Sticker not included in this export'];
  PLACEHOLDER[T.AUDIO]=['🎙','Voice message'];
  PLACEHOLDER[T.DOCUMENT]=['📄','Document'];
  PLACEHOLDER[T.GIF]=['▶','GIF not included in this export'];
  PLACEHOLDER[T.CONTACT]=['👤','Contact card'];

  function fmtTime(ts){
    var d=new Date(ts),h=d.getHours(),m=(''+d.getMinutes()).padStart(2,'0'),ap=h>=12?'PM':'AM';
    h=h%12; if(h===0)h=12; return h+':'+m+' '+ap;
  }
  var WD=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MO=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function startOfDay(ts){var d=new Date(ts);d.setHours(0,0,0,0);return d.getTime();}
  function fmtDivider(ts){
    var day=startOfDay(ts),today=startOfDay(Date.now()),diff=Math.round((today-day)/86400000);
    if(diff===0)return'Today'; if(diff===1)return'Yesterday';
    if(diff>1&&diff<7)return WD[new Date(ts).getDay()];
    var d=new Date(ts); return d.getDate()+' '+MO[d.getMonth()]+' '+d.getFullYear();
  }
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function linkify(body){
    var lines=body.split('\\n');
    return lines.map(function(line){
      return esc(line).replace(/(https?:\\/\\/[^\\s]+)/g, function(u){return '<a href="'+u+'" target="_blank" rel="noreferrer">'+u+'</a>';});
    }).join('<br>');
  }
  function colorForSender(name){
    var hash=0; for(var i=0;i<name.length;i++)hash=(hash*31+name.charCodeAt(i))|0;
    var c=['#e17076','#7bc862','#65aadd','#a695e7','#ee7aae','#6ec9cb','#faa774','#a0c0a8'];
    return c[Math.abs(hash)%c.length];
  }

  // Build the flat row list once (divider/system/msg), same grouping
  // rule as the live app: consecutive same-sender messages share a tail.
  var rows=[]; var lastDay=null, lastSender=-1;
  for(var i=0;i<D.ts.length;i++){
    var type=D.type[i];
    if(type!==T.SYSTEM){
      var day=startOfDay(D.ts[i]);
      if(day!==lastDay){ rows.push({k:'d',label:fmtDivider(D.ts[i])}); lastDay=day; lastSender=-1; }
    }
    if(type===T.SYSTEM){ rows.push({k:'s',i:i}); continue; }
    var sender=D.senderId[i];
    var first = sender!==lastSender || type===T.CALL;
    rows.push({k:'m',i:i,first:first});
    lastSender=sender;
  }

  var rowsEl=document.getElementById('rows');
  var rendered=0;
  var BATCH=150;

  function mediaEl(type, mediaKey, flags, caption){
    var hasFile = (flags & F.HAS_FILE) && mediaKey && D.media[mediaKey];
    if(!hasFile){
      var ph=PLACEHOLDER[type]||['📎','Media'];
      var html='<div class="media-placeholder"><div class="media-placeholder-icon">'+ph[0]+'</div><span>'+esc(ph[1])+'</span></div>';
      if(caption) html+='<div class="bubble-caption">'+linkify(caption)+'</div>';
      return html;
    }
    var src=D.media[mediaKey];
    if(type===T.IMAGE){
      var html='<img class="media-image" src="'+src+'" onclick="openLightbox(this.src)">';
      if(caption) html+='<div class="bubble-caption">'+linkify(caption)+'</div>';
      return html;
    }
    if(type===T.STICKER) return '<img class="media-sticker" src="'+src+'">';
    var ph2=PLACEHOLDER[type]||['📎','Media'];
    return '<div class="media-placeholder"><div class="media-placeholder-icon">'+ph2[0]+'</div><span>'+esc(ph2[1])+'</span></div>';
  }

  function rowHtml(row){
    if(row.k==='d') return '<div class="date-divider"><span>'+esc(row.label)+'</span></div>';
    var i=row.i, type=D.type[i], flags=D.flags[i], body=D.bodies[i]||'';
    if(row.k==='s') return '<div class="row-system"><div class="bubble-system">'+esc(body)+'</div></div>';

    var sender=D.senderId[i], outgoing=sender===D.meId, side=outgoing?'out':'in';
    var senderName=D.senders[sender]||'Unknown';
    var groupClass = row.first?'gfirst':'grest';
    var meta='<span class="bubble-meta">'+
      ((flags&F.EDITED)?'<span style="font-style:italic">edited</span> ':'')+
      (D.showTimestamps?esc(fmtTime(D.ts[i]))+' ':'')+
      (outgoing?'<span style="color:var(--accent)">✓✓</span>':'')+
      '</span>';

    var inner;
    if(type===T.DELETED){
      inner='<div class="bubble deleted '+side+'">🚫 This message was deleted'+meta+'</div>';
    } else if(type===T.CALL){
      var missed=flags&F.MISSED, isVideo=/video/i.test(body);
      inner='<div class="bubble call '+side+'"><span class="call-icon'+(missed?' missed':'')+'">'+(missed?'✕':(isVideo?'🎥':'📞'))+'</span><span>'+esc(body)+'</span>'+meta+'</div>';
    } else if(MEDIA_TYPES.indexOf(type)>=0){
      if(type===T.STICKER){
        inner='<div class="sticker-wrap">'+mediaEl(type,D.mediaKey[i],flags,body)+'<span class="sticker-time">'+(D.showTimestamps?esc(fmtTime(D.ts[i])):'')+'</span></div>';
        return '<div class="row '+side+' '+groupClass+'">'+inner+'</div>';
      }
      var senderLabel = (D.showSenderName && !outgoing && row.first) ? '<div class="bubble-sender" style="color:'+colorForSender(senderName)+'">'+esc(senderName)+'</div>' : '';
      inner='<div class="bubble media '+side+'">'+senderLabel+mediaEl(type,D.mediaKey[i],flags,body)+meta+'</div>';
    } else {
      var senderLabel2 = (D.showSenderName && !outgoing && row.first) ? '<div class="bubble-sender" style="color:'+colorForSender(senderName)+'">'+esc(senderName)+'</div>' : '';
      inner='<div class="bubble text '+side+'">'+senderLabel2+'<span class="bubble-text">'+linkify(body)+'</span>'+meta+'</div>';
    }
    return '<div class="row '+side+' '+groupClass+'">'+inner+'</div>';
  }

  function renderNext(){
    var end=Math.min(rendered+BATCH, rows.length);
    var html='';
    for(var i=rendered;i<end;i++) html+=rowHtml(rows[i]);
    rowsEl.insertAdjacentHTML('beforeend', html);
    rendered=end;
    if(rendered>=rows.length && observer) observer.disconnect();
  }

  window.openLightbox=function(src){
    var lb=document.getElementById('lightbox');
    if(!lb){
      lb=document.createElement('div'); lb.id='lightbox';
      lb.innerHTML='<img>'; lb.onclick=function(){lb.classList.remove('open');};
      document.body.appendChild(lb);
    }
    lb.querySelector('img').src=src;
    lb.classList.add('open');
  };

  document.getElementById('hdr-avatar').textContent=(D.contactName||'?').split(/\\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0].toUpperCase();}).join('');
  document.getElementById('hdr-name').textContent=D.contactName;
  document.getElementById('hdr-sub').textContent=D.ts.length.toLocaleString()+' messages · '+D.dateRange;
  document.title='Chat with '+D.contactName;

  renderNext();
  var sentinel=document.getElementById('sentinel');
  var scrollEl=document.getElementById('scroll');
  var observer=new IntersectionObserver(function(entries){
    if(entries[0].isIntersecting) renderNext();
  }, {root:scrollEl, rootMargin:'1200px'});
  observer.observe(sentinel);
  // Plain scroll listener as a fallback/supplement to the observer above —
  // some embedding contexts throttle or delay IntersectionObserver
  // callbacks (e.g. a backgrounded tab), and this file needs to keep
  // working as a bare double-clicked document, not just in a live tab.
  scrollEl.addEventListener('scroll', function(){
    if(scrollEl.scrollHeight-scrollEl.scrollTop-scrollEl.clientHeight<1500) renderNext();
  }, {passive:true});
  // Opens at the top (start of the exported range) rather than jumping
  // to the newest message like the live app — batches load top-down as
  // the reader scrolls, so this reads like a document from the start.
})();
`;
