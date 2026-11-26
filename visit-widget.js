/*! 串門子鄰居元件 visit-widget.js（協定 khmap-visit/1）
 * 嵌入：<div id="khmap-visit"></div>
 *       <script src="visit-widget.js" data-status="https://example.org/api/visit/status" defer></script>
 * 單檔、不載任何外部資源；站台資料一律以 textContent 寫入。 */
(function () {
  "use strict";

  var PROTOCOL = "khmap-visit/1";
  var MAX_SITES = 50;
  var MAX_NAME = 40;
  var MAX_CITY = 40;
  var ANIM_MS = 700; // 動畫總長，需小於 800 毫秒以免超過使用者啟動時效
  var DEFAULT_COLOR = "#2a7ab0";

  // ---- 純函式（可在 Node 測試） ----

  // 語言：data-lang 為 zh 或 en 時優先；否則看文件語言，zh 開頭用中文，其餘英文
  function pickLang(attr, docLang) {
    var a = typeof attr === "string" ? attr.trim().toLowerCase() : "";
    if (a === "zh" || a === "en") return a;
    var d = typeof docLang === "string" ? docLang.trim().toLowerCase() : "";
    return d.indexOf("zh") === 0 ? "zh" : "en";
  }

  // 截斷字串（以 Unicode 字元計），超過上限補「…」，總長不超過 max
  function truncate(s, max) {
    if (typeof s !== "string") return "";
    var t = s.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
    var arr = Array.from(t);
    if (arr.length <= max) return t;
    return arr.slice(0, Math.max(0, max - 1)).join("") + "…";
  }

  // 顏色只接受 #rrggbb
  function safeColor(c) {
    return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : DEFAULT_COLOR;
  }

  // 網址只接受 https:；allowLocal 為真時另接受 http://localhost 與 http://127.0.0.1。回傳 { href, host } 或 null
  function safeUrl(raw, allowLocal) {
    if (typeof raw !== "string" || !raw || raw.length > 300) return null;
    var u;
    try {
      u = new URL(raw);
    } catch (e) {
      return null;
    }
    if (u.username || u.password) return null;
    var ok = u.protocol === "https:" || (!!allowLocal && u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
    if (!ok) return null;
    return { href: u.href, host: u.host };
  }

  // 取 { zh, en } 文字：中文用 zh，英文優先 en、缺少時退回 zh
  function pickText(o, lang, max) {
    if (!o || typeof o !== "object") return "";
    var zh = typeof o.zh === "string" ? o.zh : "";
    var en = typeof o.en === "string" ? o.en : "";
    return truncate(lang === "en" ? en || zh : zh || en, max);
  }

  // 解析 status：不合法、關閉或沒有鄰居一律回傳空陣列
  function parseStatus(st, lang, allowLocal) {
    if (!st || typeof st !== "object" || Array.isArray(st)) return [];
    if (st.protocol !== PROTOCOL || st.enabled !== true || !Array.isArray(st.joined)) return [];
    var out = [];
    for (var i = 0; i < st.joined.length && out.length < MAX_SITES; i++) {
      var c = st.joined[i];
      if (!c || typeof c !== "object") continue;
      var url = safeUrl(c.site_url, allowLocal);
      if (!url) continue;
      var name = pickText(c.name, lang, MAX_NAME) || truncate(url.host, MAX_NAME);
      out.push({ name: name, city: pickText(c.city, lang, MAX_CITY), color: safeColor(c.color), href: url.href, host: truncate(url.host, 60) });
    }
    return out;
  }

  // status 網址：data-status 優先，其次 data-api（接 /api/visit/status），最後用目前網站
  function resolveStatusUrl(dataStatus, dataApi, base) {
    var path = "/api/visit/status";
    try {
      if (dataStatus) return new URL(dataStatus, base).href;
      if (dataApi) return new URL(String(dataApi).replace(/\/+$/, "") + path, base).href;
      return new URL(path, base).href;
    } catch (e) {
      return null;
    }
  }

  var I18N = {
    zh: { title: "鄰居小島", blocked: "新分頁被瀏覽器擋下，請點此前往", openTpl: "前往鄰居小島 {n}（開新分頁）" },
    en: { title: "Neighbor islands", blocked: "Popup blocked. Click here to visit", openTpl: "Visit neighbor island {n} (opens in a new tab)" },
  };

  var core = { PROTOCOL: PROTOCOL, MAX_SITES: MAX_SITES, MAX_NAME: MAX_NAME, I18N: I18N, pickLang: pickLang, truncate: truncate, safeColor: safeColor, safeUrl: safeUrl, pickText: pickText, parseStatus: parseStatus, resolveStatusUrl: resolveStatusUrl };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (typeof document === "undefined" || typeof window === "undefined") return;

  // ---- 瀏覽器端 ----

  var SVGNS = "http://www.w3.org/2000/svg";
  var STYLE =
    ":host{display:block;--bg:#ffffff;--card:#f3f8fb;--bd:#7f9fb2;--tx:#14303f;--sub:#35505f;--hl:#0b5a85;--sea:#d6ebf6}" +
    "@media (prefers-color-scheme:dark){:host{--bg:#0f1c24;--card:#182a35;--bd:#4c6a7b;--tx:#eaf4fa;--sub:#b9cfdb;--hl:#8fd0f5;--sea:#1d3544}}" +
    ".w{font:14px/1.5 system-ui,-apple-system,'Segoe UI','Noto Sans TC','Microsoft JhengHei',sans-serif;color:var(--tx);background:var(--bg);padding:12px;box-sizing:border-box;max-width:100%}" +
    "h2{font-size:16px;margin:0 0 8px;font-weight:700}" +
    ".row{display:flex;flex-wrap:wrap;gap:10px}" +
    ".card{position:relative;overflow:hidden;flex:1 1 140px;min-width:0;max-width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:8px 10px;cursor:pointer;text-align:left;color:var(--tx);font:inherit;display:flex;flex-direction:column;gap:2px}" +
    ".card:hover{border-color:var(--hl)}" +
    ".card:focus-visible{outline:3px solid var(--hl);outline-offset:2px}" +
    ".sea{position:relative;background:var(--sea);border-radius:6px;height:44px;display:flex;align-items:center;justify-content:center;margin-bottom:4px}" +
    ".nm{font-weight:700;overflow-wrap:anywhere}.ct{color:var(--sub);overflow-wrap:anywhere}.ho{color:var(--sub);font-size:12px;overflow-wrap:anywhere}" +
    ".fb{display:block;color:var(--hl);font-weight:700;text-decoration:underline;margin-top:4px;overflow-wrap:anywhere}" +
    ".ride{position:absolute;left:0;top:8px;pointer-events:none}";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // 主題色小島圖形
  function islandSvg(color) {
    var s = svg("svg", { viewBox: "0 0 60 30", width: "60", height: "30", "aria-hidden": "true", focusable: "false" });
    s.appendChild(svg("ellipse", { cx: "30", cy: "24", rx: "26", ry: "5", fill: "#ffffff", opacity: "0.55" }));
    s.appendChild(svg("path", { d: "M8 24 Q14 8 30 8 Q46 8 52 24 Z", fill: color, stroke: "#14303f", "stroke-opacity": "0.45", "stroke-width": "1" }));
    s.appendChild(svg("path", { d: "M30 8 L30 3", stroke: "#14303f", "stroke-width": "1.5" }));
    s.appendChild(svg("circle", { cx: "30", cy: "3", r: "2", fill: color, stroke: "#14303f", "stroke-opacity": "0.45" }));
    return s;
  }

  // 簡化的船或飛機圖形
  function rideSvg(kind) {
    var s = svg("svg", { viewBox: "0 0 24 24", width: "28", height: "28", "aria-hidden": "true", focusable: "false", class: "ride" });
    if (kind === "boat") {
      s.appendChild(svg("path", { d: "M3 16 L21 16 L18 21 L6 21 Z", fill: "#c0392b" }));
      s.appendChild(svg("path", { d: "M12 3 L12 15 L18 15 Z", fill: "#ffffff", stroke: "#14303f", "stroke-width": "0.8" }));
    } else {
      s.appendChild(svg("path", { d: "M2 13 L22 9 L22 11 L14 14 L10 20 L8 20 L10 14 L4 15 Z", fill: "#ffffff", stroke: "#14303f", "stroke-width": "0.8", "stroke-linejoin": "round" }));
    }
    return s;
  }

  function reduced() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  // 開新分頁並切斷 opener；回傳是否成功（被擋時為 false）。不用 noopener 特徵字串，因為它會讓 window.open 永遠回傳 null，無法偵測被擋
  function openTab(href) {
    var w = null;
    try {
      w = window.open(href, "_blank");
    } catch (e) {}
    if (!w) return false;
    try {
      w.opener = null;
    } catch (e) {}
    return true;
  }

  function visit(card, site, sea, t) {
    if (card._busy) return;
    var done = function () {
      card._busy = false;
      if (openTab(site.href)) return;
      if (card.querySelector(".fb")) return;
      var a = el("a", "fb", t.blocked + " " + site.name);
      a.href = site.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      card.appendChild(a);
    };
    if (reduced()) return done();
    card._busy = true;
    var kind = Math.random() < 0.5 ? "boat" : "plane";
    var ride = rideSvg(kind);
    sea.appendChild(ride);
    var w = Math.max(0, sea.clientWidth - 28);
    try {
      ride.animate([{ transform: "translate(0,0)" }, { transform: "translate(" + w + "px," + (kind === "plane" ? -8 : 0) + "px)" }], { duration: ANIM_MS - 100, easing: "ease-in", fill: "forwards" });
    } catch (e) {}
    setTimeout(done, ANIM_MS);
  }

  function render(host, sites, lang) {
    var t = I18N[lang];
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var st = document.createElement("style");
    st.textContent = STYLE;
    root.appendChild(st);
    var wrap = el("div", "w");
    wrap.appendChild(el("h2", "", t.title));
    var row = el("div", "row");
    sites.forEach(function (site) {
      var card = el("button", "card");
      card.type = "button";
      var sep = lang === "en" ? ", " : "，";
      var label = site.name + (site.city ? sep + site.city : "") + sep + site.host;
      card.setAttribute("aria-label", t.openTpl.replace("{n}", label));
      var sea = el("div", "sea");
      sea.appendChild(islandSvg(site.color));
      card.appendChild(sea);
      card.appendChild(el("span", "nm", site.name));
      if (site.city) card.appendChild(el("span", "ct", site.city));
      card.appendChild(el("span", "ho", site.host));
      card.addEventListener("click", function () {
        visit(card, site, sea, t);
      });
      row.appendChild(card);
    });
    wrap.appendChild(row);
    root.appendChild(wrap);
  }

  function start(script) {
    var statusUrl = resolveStatusUrl(script.getAttribute("data-status"), script.getAttribute("data-api"), location.href);
    if (!statusUrl) return;
    var lang = pickLang(script.getAttribute("data-lang"), document.documentElement.lang);
    var allowLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    var sel = script.getAttribute("data-target") || "#khmap-visit";
    fetch(statusUrl, { headers: { accept: "application/json" }, credentials: "omit", redirect: "error" })
      .then(function (r) {
        if (!r.ok) throw new Error("status");
        return r.json();
      })
      .then(function (data) {
        var sites = parseStatus(data, lang, allowLocal);
        if (!sites.length) return;
        var host = null;
        try {
          host = document.querySelector(sel);
        } catch (e) {}
        if (!host) {
          host = document.createElement("div");
          if (script.parentNode) script.parentNode.insertBefore(host, script.nextSibling);
          else document.body.appendChild(host);
        }
        if (host.shadowRoot) return;
        render(host, sites, lang);
      })
      .catch(function () {});
  }

  var cur = document.currentScript;
  if (cur) start(cur);
})();
