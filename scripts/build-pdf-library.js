#!/usr/bin/env node
/* يبني قسم PDF Library من data/books.json:
   - كيجيب الأغلفة من Internet Archive
   - كيولد pdf-library.html
   - كيزيد رابط فـnav ديال index + صفحات الفئات
   - كيزيد الصفحة فـsitemap.xml وsearch-index.json وllms.txt
   التشغيل: node scripts/build-pdf-library.js  */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "books.json"), "utf8"));
const SITE = "https://crochetguide.uk";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fileUrl(book) {
  return `${SITE}/img/books/${book.slug}.jpg`;
}

function pdfUrl(book) {
  const file = book.pdf_file.split("/").map(encodeURIComponent).join("/");
  return `https://archive.org/download/${book.ia_id}/${file}`;
}

function sourceUrl(book) {
  return `https://archive.org/details/${book.ia_id}`;
}

function coverUrl(book) {
  return `https://archive.org/download/${book.ia_id}/page/n0_w600.jpg`;
}

async function downloadCover(book) {
  const out = path.join(ROOT, "img", "books", `${book.slug}.jpg`);
  if (fs.existsSync(out) && fs.statSync(out).size > 5000) return "cached";
  const candidates = [coverUrl(book), `https://archive.org/services/img/${book.ia_id}`];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !/image\//.test(type)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) continue;
      fs.writeFileSync(out, buf);
      return "downloaded";
    } catch (e) { /* try next */ }
  }
  return "missing";
}

const CATEGORY_ORDER = ["Lessons & Technique", "Edgings & Borders", "Yokes & Wearables", "Pattern Books", "Lace & Filet"];

function pills(books) {
  const counts = {};
  books.forEach((b) => { counts[b.category] = (counts[b.category] || 0) + 1; });
  const items = [`<button class="pill active" type="button" data-filter="all">All (${books.length})</button>`];
  CATEGORY_ORDER.forEach((c) => {
    if (!counts[c]) return;
    items.push(`<button class="pill" type="button" data-filter="${esc(c)}">${esc(c)} (${counts[c]})</button>`);
  });
  return items.join("\n      ");
}

function cards(books) {
  return books.map((b) => `<div class="book-card" data-cat="${esc(b.category)}">
        <a class="book-cover" href="${esc(sourceUrl(b))}" target="_blank" rel="noopener">
          <img src="/img/books/${esc(b.slug)}.jpg" alt="Cover of ${esc(b.title)}" width="600" height="800" loading="lazy" decoding="async">
        </a>
        <div class="book-body">
          <span class="book-cat">${esc(b.category)}</span>
          <h2>${esc(b.title)}</h2>
          <p class="book-desc">${esc(b.blurb)}</p>
          <p class="book-meta">${b.approx ? "c. " : ""}${b.year}${b.publisher ? " · " + esc(b.publisher) : ""} · PDF ${b.size_mb} MB · Public domain</p>
          <div class="book-actions">
            <a class="btn-dl" href="${esc(pdfUrl(b))}" target="_blank" rel="noopener">Download PDF</a>
            <a class="btn-ia" href="${esc(sourceUrl(b))}" target="_blank" rel="noopener">Source page</a>
          </div>
        </div>
      </div>`).join("\n      ");
}

function jsonLd(books) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Free Vintage Crochet Books — Public Domain PDF Library",
    url: SITE + "/pdf-library",
    description: "A free library of vintage crochet books and pattern leaflets published before 1930, all in the public domain.",
    isPartOf: { "@type": "WebSite", name: "CrochetGuides", url: SITE + "/" },
    hasPart: books.map((b) => ({
      "@type": "Book",
      name: b.title,
      datePublished: String(b.year),
      bookFormat: "https://schema.org/EBook",
      isAccessibleForFree: true,
      url: sourceUrl(b),
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(itemList, null, 2)}\n</script>`;
}

function html(books) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ZLKW21MDJZ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-ZLKW21MDJZ');
</script>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Free Vintage Crochet Books — Public Domain PDF Library | CrochetGuides</title>
<meta name="description" content="20 free vintage crochet books and pattern leaflets from 1890s–1929, all in the public domain: edgings, yokes, filet lace, baby patterns and lessons. Read online or download the PDF.">
<link rel="canonical" href="${SITE}/pdf-library">
<meta name="robots" content="index, follow">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%2322404F'/%3E%3Cpath d='M8 3c-2.5 0-4.5 2-4.5 4.5S5.5 12 8 12h4c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5' fill='none' stroke='%23EDE6D9' stroke-width='1.8' stroke-linecap='round'/%3E%3Ccircle cx='17.2' cy='4.8' r='1.7' fill='%23D8A23C'/%3E%3C/svg%3E">

<meta property="og:type" content="website">
<meta property="og:site_name" content="CrochetGuides">
<meta property="og:title" content="Free Vintage Crochet Books — Public Domain PDF Library">
<meta property="og:description" content="20 vintage crochet books and pattern leaflets (1890s–1929) you can read and download for free, legally.">
<meta property="og:url" content="${SITE}/pdf-library">
<meta property="og:image" content="${SITE}/img/books/royal-society-crochet-lessons-1.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Free Vintage Crochet Books — Public Domain PDF Library">
<meta name="twitter:description" content="20 vintage crochet books and pattern leaflets (1890s–1929) you can read and download for free, legally.">

${jsonLd(books)}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Work+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">

<style>
:root{--wool:#EDE6D9;--wool-2:#E4DACB;--card:#FBF8F2;--ink:#2A241E;--ink-soft:#5A5148;--teal:#33586B;--teal-dark:#22404F;--mustard:#D8A23C;--berry:#A63B4A;--line:rgba(42,36,30,0.14);--radius:4px;--maxw:1100px;}
*{box-sizing:border-box;}
body{margin:0;background:var(--wool);color:var(--ink);font-family:'Work Sans',sans-serif;font-size:17px;line-height:1.7;-webkit-font-smoothing:antialiased;}
a{color:var(--teal-dark);}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px;}
header{padding:22px 0;border-bottom:1px solid var(--line);}
header .wrap{display:flex;align-items:center;justify-content:space-between;}
.logo{font-family:'Fraunces',serif;font-weight:700;font-size:20px;display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink);}
.logo svg{width:18px;height:18px;}
.back{font-size:14px;font-weight:600;text-decoration:none;}
.breadcrumb{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-soft);margin-top:20px;}
.breadcrumb a{color:var(--ink-soft);text-decoration:none;}
.breadcrumb a:hover{color:var(--teal-dark);}
.breadcrumb .sep{margin:0 6px;opacity:0.5;}
.eyebrow{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:var(--berry);}
h1,h2,h3{font-family:'Fraunces',serif;font-weight:600;margin:0 0 14px;letter-spacing:-0.01em;}
main{padding:16px 0 64px;}
h1{font-size:clamp(1.7rem,4vw,2.4rem);line-height:1.15;margin-top:12px;}
.dek{font-size:18px;color:var(--ink-soft);margin:16px 0 24px;max-width:65ch;}
.license-note{background:var(--card);border-left:3px solid var(--mustard);padding:14px 16px;font-size:13.5px;color:var(--ink-soft);margin:0 0 28px;border-radius:var(--radius);max-width:75ch;}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px;}
.pill{font-family:'Space Mono',monospace;font-size:12px;padding:7px 12px;border-radius:20px;background:var(--card);border:1px solid var(--line);cursor:pointer;color:var(--ink-soft);}
.pill:hover{color:var(--ink);}
.pill.active{background:var(--teal-dark);color:var(--card);border-color:var(--teal-dark);}
.books{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;}
@media (max-width:860px){ .books{grid-template-columns:repeat(2,1fr);} }
@media (max-width:600px){ .books{grid-template-columns:1fr;} }
.book-card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;transition:transform .18s ease, box-shadow .18s ease;}
.book-card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(42,36,30,0.10);}
.book-card[hidden]{display:none;}
.book-cover{display:block;aspect-ratio:3/4;background:var(--wool-2);overflow:hidden;}
.book-cover img{width:100%;height:100%;object-fit:cover;display:block;}
.book-body{padding:18px 18px 20px;display:flex;flex-direction:column;gap:8px;flex:1;}
.book-cat{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--berry);}
.book-card h2{font-size:17px;line-height:1.25;margin:0;}
.book-desc{font-size:13.5px;color:var(--ink-soft);margin:0;flex:1;}
.book-meta{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-soft);margin:0;}
.book-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}
.btn-dl{background:var(--teal-dark);color:var(--card);text-decoration:none;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:var(--radius);}
.btn-dl:hover{background:var(--teal);}
.btn-ia{border:1px solid var(--line);color:var(--ink-soft);text-decoration:none;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:var(--radius);}
.btn-ia:hover{color:var(--ink);}
.cat-nav{margin-top:48px;padding-top:24px;border-top:1px solid var(--line);}
.cat-nav h2{font-size:16px;margin-bottom:14px;}
.cat-pills{display:flex;flex-wrap:wrap;gap:8px;}
.cat-pill{font-family:'Space Mono',monospace;font-size:12px;padding:7px 12px;border-radius:20px;background:var(--card);border:1px solid var(--line);text-decoration:none;color:var(--ink-soft);}
footer{border-top:1px solid var(--line);padding:24px 0;font-size:13px;color:var(--ink-soft);}
footer .fine{margin:0 0 14px;}
footer nav a{margin-right:16px;text-decoration:none;color:var(--ink-soft);font-weight:600;font-size:13px;}
.search-btn{background:none;border:none;cursor:pointer;color:var(--ink);padding:6px;display:flex;align-items:center;flex:none;}
.search-btn:hover{color:var(--teal-dark);}
.search-overlay{position:fixed;inset:0;background:rgba(42,36,30,0.55);z-index:999;display:flex;align-items:flex-start;justify-content:center;padding:10vh 20px 20px;}
.search-overlay[hidden]{display:none;}
.search-box{background:var(--card);border-radius:var(--radius);max-width:560px;width:100%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,0.25);max-height:70vh;display:flex;flex-direction:column;}
.search-row{display:flex;gap:8px;align-items:center;}
.search-row input{flex:1;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius);font-size:16px;font-family:'Work Sans',sans-serif;background:var(--wool);color:var(--ink);box-sizing:border-box;}
.search-close{background:none;border:none;font-size:24px;cursor:pointer;color:var(--ink-soft);flex:none;padding:2px 8px;line-height:1;}
.search-results{margin-top:14px;overflow-y:auto;}
.search-result{display:block;padding:10px 8px;text-decoration:none;color:var(--ink);border-radius:var(--radius);}
.search-result:hover{background:var(--wool);}
.search-result .r-cat{font-family:'Space Mono',monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:var(--berry);display:block;margin-bottom:2px;}
.search-result .r-title{font-family:'Fraunces',serif;font-weight:600;font-size:15px;}
.search-empty{color:var(--ink-soft);font-size:14px;padding:10px 8px;}
</style>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2407314174904220" crossorigin="anonymous"></script>
</head>
<body>

<header>
  <div class="wrap">
    <a class="logo" href="/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3c-2.5 0-4.5 2-4.5 4.5S5.5 12 8 12h4c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5"/><circle cx="17.2" cy="4.8" r="1.6"/></svg>
      CrochetGuides
    </a>
    <div style="display:flex;align-items:center;gap:14px;">
      <a class="back" href="/">&larr; All guides</a>
      <button class="search-btn" id="searchBtn" aria-label="Search guides" type="button"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
    </div>
  </div>
</header>

<div class="search-overlay" id="searchOverlay" hidden>
  <div class="search-box">
    <div class="search-row">
      <input type="text" id="searchInput" placeholder="Search guides..." autocomplete="off">
      <button class="search-close" id="searchClose" aria-label="Close search" type="button">&times;</button>
    </div>
    <div class="search-results" id="searchResults"></div>
  </div>
</div>

<main>
  <div class="wrap">
    <p class="breadcrumb">
      <a href="/">Home</a><span class="sep">/</span>PDF Library
    </p>
    <span class="eyebrow">Free public-domain library</span>
    <h1>Vintage crochet books you can legally download</h1>
    <p class="dek">${books.length} crochet books and pattern leaflets published between the 1890s and 1929, all in the public domain. Old charts, forgotten edgings, yokes and filet designs &mdash; free to read, print and use.</p>
    <p class="license-note"><strong>Why these are free:</strong> every title here was published before 1930, so copyright has expired. The scans are hosted by the Internet Archive, and each card links to both the PDF and its source page. Please keep the source credit if you reuse a scan.</p>

    <div class="pills" id="pills">
      ${pills(books)}
    </div>

    <div class="books" id="books">
      ${cards(books)}
    </div>

    <div class="cat-nav">
      <h2>Browse the guides</h2>
      <div class="cat-pills">
        <a class="cat-pill" href="/categories/amigurumi-toys">Amigurumi &amp; Toys</a>
        <a class="cat-pill" href="/categories/baby-kids">Baby &amp; Kids</a>
        <a class="cat-pill" href="/categories/bags-accessories">Bags &amp; Accessories</a>
        <a class="cat-pill" href="/categories/guides-comparisons">Guides &amp; Comparisons</a>
        <a class="cat-pill" href="/categories/home-decor">Home &amp; Décor</a>
        <a class="cat-pill" href="/categories/seasonal-holiday">Seasonal &amp; Holiday</a>
        <a class="cat-pill" href="/categories/techniques-tutorials">Techniques &amp; Tutorials</a>
        <a class="cat-pill" href="/categories/wearables">Wearables</a>
      </div>
    </div>
  </div>
</main>

<footer>
  <div class="wrap">
    <p class="fine">
      CrochetGuides is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. As an Amazon Associate we earn from qualifying purchases.
    </p>
    <nav>
      <a href="/#guides">Guides</a>
      <a href="/#picks">Picks</a>
      <a href="/pdf-library">PDF Library</a>
      <a href="/about">About</a>
      <a href="/privacy-policy">Privacy</a>
    </nav>
    <p class="fine" style="margin-top:14px;">Public-domain scans courtesy of the <a href="https://archive.org/" target="_blank" rel="noopener">Internet Archive</a>. &copy; ${year} CrochetGuides.</p>
  </div>
</footer>

<script>
(function(){
  var pills = document.getElementById('pills');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.book-card'));
  if(pills){
    pills.addEventListener('click', function(e){
      var btn = e.target.closest('.pill');
      if(!btn) return;
      Array.prototype.forEach.call(pills.querySelectorAll('.pill'), function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      cards.forEach(function(c){ c.hidden = (f !== 'all' && c.getAttribute('data-cat') !== f); });
    });
  }

  var btn = document.getElementById('searchBtn');
  var overlay = document.getElementById('searchOverlay');
  var input = document.getElementById('searchInput');
  var closeBtn = document.getElementById('searchClose');
  var results = document.getElementById('searchResults');
  var index = null;

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function loadIndex(cb){
    if(index){ cb(); return; }
    fetch('/search-index.json').then(function(r){return r.json();}).then(function(data){
      index = data; cb();
    }).catch(function(){ index = []; cb(); });
  }

  function render(query){
    var q = query.trim().toLowerCase();
    if(!q){ results.innerHTML = ''; return; }
    var matches = index.filter(function(item){
      return item.title.toLowerCase().indexOf(q) > -1 ||
             item.desc.toLowerCase().indexOf(q) > -1 ||
             item.category.toLowerCase().indexOf(q) > -1;
    }).sort(function(a,b){
      var at = a.title.toLowerCase().indexOf(q) > -1 ? 0 : 1;
      var bt = b.title.toLowerCase().indexOf(q) > -1 ? 0 : 1;
      return at - bt;
    }).slice(0, 8);
    if(matches.length === 0){
      results.innerHTML = '<div class="search-empty">No guides found. Try a different word.</div>';
      return;
    }
    results.innerHTML = matches.map(function(m){
      return '<a class="search-result" href="'+m.url+'"><span class="r-cat">'+esc(m.category)+'</span><span class="r-title">'+esc(m.title)+'</span></a>';
    }).join('');
  }

  function openSearch(){
    overlay.hidden = false;
    loadIndex(function(){
      input.value = '';
      results.innerHTML = '';
      setTimeout(function(){ input.focus(); }, 30);
    });
    document.addEventListener('keydown', onKey);
  }
  function closeSearch(){
    overlay.hidden = true;
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e){ if(e.key === 'Escape') closeSearch(); }

  if(btn) btn.addEventListener('click', openSearch);
  if(closeBtn) closeBtn.addEventListener('click', closeSearch);
  if(overlay) overlay.addEventListener('click', function(e){ if(e.target === overlay) closeSearch(); });
  if(input) input.addEventListener('input', function(){ render(input.value); });
})();
</script>
</body>
</html>
`;
}

function patchNav() {
  const link = `<a href="/pdf-library" style="display:inline-flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 0 4 23z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5A2.5 2.5 0 0 1 20 23z"/></svg>PDF Library</a>`;
  const indexFile = path.join(ROOT, "index.html");
  let s = fs.readFileSync(indexFile, "utf8");
  if (!s.includes('href="/pdf-library"')) {
    s = s.replace(/(\s*<a href="\/about">About<\/a>)/, `\n      ${link}$1`);
    fs.writeFileSync(indexFile, s);
    console.log("nav: index.html ✓");
  }

  const catDir = path.join(ROOT, "categories");
  for (const f of fs.readdirSync(catDir).filter((x) => x.endsWith(".html"))) {
    const p = path.join(catDir, f);
    let c = fs.readFileSync(p, "utf8");
    if (c.includes('href="/pdf-library"')) continue;
    if (!c.includes('<a class="back" href="/">')) continue;
    c = c.replace(/(\s*)<a class="back" href="\/">/, '$1<a class="back" href="/pdf-library">PDF Library</a>$1<a class="back" href="/">');
    fs.writeFileSync(p, c);
    console.log("nav:", "categories/" + f, "✓");
  }
}

function patchSitemap() {
  const p = path.join(ROOT, "sitemap.xml");
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("<loc>" + SITE + "/pdf-library</loc>")) return;
  const entry = `  <url>\n    <loc>${SITE}/pdf-library</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  s = s.replace(/(\s*<\/urlset>)/, "\n" + entry + "$1");
  fs.writeFileSync(p, s);
  console.log("sitemap.xml ✓");
}

function patchSearchIndex() {
  const p = path.join(ROOT, "search-index.json");
  const idx = JSON.parse(fs.readFileSync(p, "utf8"));
  if (idx.some((x) => x.url === "/pdf-library")) return;
  idx.unshift({
    title: "Free Vintage Crochet Books — Public Domain PDF Library",
    url: "/pdf-library",
    desc: "20 vintage crochet books and pattern leaflets (1890s–1929) in the public domain, free to read and download.",
    category: "PDF Library",
  });
  fs.writeFileSync(p, JSON.stringify(idx));
  console.log("search-index.json ✓");
}

function patchLlms() {
  const p = path.join(ROOT, "llms.txt");
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("/pdf-library")) return;
  s += `\n## Public-domain book library\n\n- [Vintage crochet books (PDF)](https://crochetguide.uk/pdf-library): 20 crochet books and pattern leaflets published before 1930, free to read and download from the Internet Archive\n`;
  fs.writeFileSync(p, s);
  console.log("llms.txt ✓");
}

(async () => {
  fs.mkdirSync(path.join(ROOT, "img", "books"), { recursive: true });
  const books = data.books;
  let got = 0;
  for (const b of books) {
    const r = await downloadCover(b);
    if (r === "downloaded") got++;
    console.log("cover:", b.slug, r);
  }
  fs.writeFileSync(path.join(ROOT, "pdf-library.html"), html(books));
  console.log("pdf-library.html ✓ (" + books.length + " books, " + got + " covers downloaded)");
  patchNav();
  patchSitemap();
  patchSearchIndex();
  patchLlms();
})().catch((e) => { console.error("build error:", e.message); process.exit(1); });
