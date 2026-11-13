// Links the 14 kept reference pages from related, indexable guides.
// node scripts/add-reference-links.js [--apply]   (dry run without --apply)
const fs = require("fs");
const path = require("path");
const dir = process.argv[2] || "guides";
const apply = process.argv.includes("--apply");

const map = {
  "us-to-uk-crochet-terms-conversion": [
    "basic-crochet-stitches", "abbreviations-glossary", "hook-size-chart",
    "amigurumi-for-beginners", "continental-vs-english-crochet",
    "how-to-read-a-pattern", "granny-square-tutorial", "yarn-weight-explained",
  ],
  "how-to-read-a-crochet-chart": [
    "basic-crochet-stitches", "granny-square-tutorial", "how-to-crochet-in-the-round",
    "crochet-border-edging-guide", "tunisian-vs-regular-crochet", "filet-crochet-tutorial",
  ],
  "single-crochet-vs-double-crochet": [
    "basic-crochet-stitches", "granny-square-tutorial", "amigurumi-for-beginners",
    "what-is-gauge-crochet",
  ],
  "how-to-increase-decrease-crochet": [
    "amigurumi-for-beginners", "amigurumi-bear-pattern", "amigurumi-cat-pattern",
    "amigurumi-elephant-pattern", "how-to-crochet-in-the-round", "invisible-decrease-amigurumi",
  ],
  "how-to-weave-in-ends": [
    "basic-crochet-stitches", "how-to-seam-crochet-pieces", "crochet-border-edging-guide",
    "how-to-fix-uneven-tension", "how-to-change-colors-crochet", "granny-square-blanket-pattern",
  ],
  "slip-stitch-crochet": [
    "basic-crochet-stitches", "crochet-border-edging-guide", "how-to-seam-crochet-pieces",
    "how-to-crochet-in-the-round", "granny-square-tutorial", "how-to-join-granny-squares",
  ],
  "fixing-dropped-stitch-unravel-row": [
    "basic-crochet-stitches", "how-to-fix-uneven-tension", "fixing-project-size",
    "how-to-crochet-in-the-round", "fixing-mistakes",
  ],
  "best-crochet-hooks-for-arthritis": [
    "hook-size-chart", "crochet-ergonomics-pencil-vs-knife-grip", "best-crochet-hook-brands",
    "best-crochet-project-bags", "how-to-fix-uneven-tension",
  ],
  "how-to-store-yarn-properly": [
    "yarn-weight-explained", "best-mercerized-cotton-yarn-guide", "best-yarn-for-amigurumi",
    "best-yarn-winder-and-swift-sets", "best-crochet-project-bags", "yarn-types-explained",
  ],
  "ebooks-vs-pdf-patterns": [
    "how-to-read-a-pattern", "how-to-read-a-crochet-chart", "abbreviations-glossary",
    "subscription-boxes",
  ],
  "crochet-vs-knitting": [
    "basic-crochet-stitches", "yarn-weight-explained", "continental-vs-english-crochet",
    "tunisian-vs-regular-crochet", "yarn-types-explained",
  ],
  "how-to-fix-uneven-tension": [
    "basic-crochet-stitches", "slip-stitch-crochet", "amigurumi-for-beginners",
    "what-is-gauge-crochet", "crochet-ergonomics-pencil-vs-knife-grip", "how-to-fix-curling-edges",
  ],
  "crochet-border-edging-guide": [
    "how-to-crochet-in-the-round", "granny-square-blanket-pattern", "baby-blanket-pattern",
    "dishcloth-pattern", "ripple-blanket-pattern", "how-to-join-granny-squares",
  ],
  "continental-vs-english-crochet": [
    "basic-crochet-stitches", "crochet-ergonomics-pencil-vs-knife-grip",
    "best-crochet-hook-brands", "how-to-fix-uneven-tension",
    "tunisian-vs-regular-crochet", "left-handed-crochet-guide",
  ],
};

function h1Of(slug) {
  const file = path.join(dir, slug + ".html");
  if (!fs.existsSync(file)) return null;
  const h = fs.readFileSync(file, "utf8");
  const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&mdash;/g, "\u2014").replace(/\s+/g, " ").trim();
}

let added = 0, skipped = [];
for (const [target, sources] of Object.entries(map)) {
  const anchor = h1Of(target);
  if (!anchor) { skipped.push(target + " (no page)"); continue; }
  for (const src of sources) {
    const file = path.join(dir, src + ".html");
    if (!fs.existsSync(file)) { skipped.push(src + " (missing)"); continue; }
    let h = fs.readFileSync(file, "utf8");
    if (/content="noindex/.test(h)) { skipped.push(src + " (noindex)"); continue; }
    if (h.includes('/guides/' + target + '"')) continue;
    const m = h.match(/<h2[^>]*>\s*(?:Related guides|Keep reading|More [^<]*|Continue [^<]*)<\/h2>\s*<ul>/i);
    if (!m) { skipped.push(src + " (no related list)"); continue; }
    const at = m.index + m[0].length;
    const li = '\n        <li><a href="/guides/' + target + '">' + anchor.replace(/&/g, "&amp;") + ' &rarr;</a></li>';
    h = h.slice(0, at) + li + h.slice(at);
    if (apply) fs.writeFileSync(file, h);
    added++;
  }
}
console.log((apply ? "APPLIED " : "DRY RUN ") + added + " link insertions");
if (skipped.length) console.log("skipped:\n  " + skipped.join("\n  "));
