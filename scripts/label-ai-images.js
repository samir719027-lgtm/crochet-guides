#!/usr/bin/env node
// Adds a visible AI-illustration credit under each guide hero listed in CREDITS.md.
// Usage: node scripts/label-ai-images.js [--apply]
const fs = require('fs');
const path = require('path');

const SLUGS = `best-blocking-mats-and-pins-guide best-crochet-project-bags
best-mercerized-cotton-yarn-guide best-neck-lights-for-crocheting
best-yarn-winder-and-swift-sets crochet-ergonomics-pencil-vs-knife-grip
crochet-hooded-scarf-pattern crochet-laptop-sleeve-pattern
crochet-water-bottle-holder-pattern hooded-scarf-pattern
how-to-store-yarn-properly yarn-weight-explained amigurumi-starter-kit
best-crochet-hook-brands best-crochet-hooks-for-arthritis hook-size-chart
basic-crochet-stitches best-youtube-channels how-to-fix-curling-edges
left-handed-crochet-guide granny-square-blanket-pattern granny-square-tutorial
how-to-join-granny-squares best-yarn-for-amigurumi yarn-types-explained
crossbody-bag-pattern granny-square-bag-pattern dish-scrubbies-pattern
how-to-wash-crochet-items ebooks-vs-pdf-patterns what-is-gauge-crochet
fixing-project-size how-much-yarn-do-i-need how-to-read-a-pattern
us-to-uk-crochet-terms-conversion`.split(/\s+/).filter(Boolean);

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..');

const CREDIT =
  '    <p class="img-credit" style="font-size:12.5px;color:var(--ink-soft);margin:-10px 0 26px;">' +
  'AI-generated illustration, not a photograph of the finished item. ' +
  '<a href="/editorial-policy#images">About our images</a></p>';

let changed = 0, skipped = 0, missing = 0;
for (const slug of SLUGS) {
  const file = path.join(ROOT, 'guides', slug + '.html');
  if (!fs.existsSync(file)) { console.log('MISSING', slug); missing++; continue; }
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('class="img-credit"')) { console.log('SKIP (already labelled)', slug); skipped++; continue; }
  const heroRe = /^([ \t]*)<img class="hero-img"[^>]*>[ \t]*$/m;
  const m = html.match(heroRe);
  if (!m) { console.log('NO HERO IMG', slug); missing++; continue; }
  const idx = m.index + m[0].length;
  html = html.slice(0, idx) + '\n' + CREDIT.replace(/^    /, m[1]) + html.slice(idx);
  if (APPLY) fs.writeFileSync(file, html);
  changed++;
  console.log((APPLY ? 'LABELLED ' : 'WOULD LABEL ') + slug);
}
console.log(JSON.stringify({ changed, skipped, missing, apply: APPLY }));
