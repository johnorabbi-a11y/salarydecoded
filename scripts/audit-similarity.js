const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!['scripts','docs','.git','node_modules','assets'].includes(ent.name)) walk(p, out);
    } else if (ent.name === 'index.html') {
      out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
  return out.sort();
}

function textFor(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&pound;/g, ' pound ')
    .replace(/&amp;/g, ' and ')
    .toLowerCase();
  return new Set(html.split(/[^a-z0-9]+/).filter(w => w.length > 3));
}

function jaccard(a, b) {
  let inter = 0;
  for (const item of a) if (b.has(item)) inter++;
  return inter / Math.max(1, a.size + b.size - inter);
}

const files = walk(ROOT);
const vectors = new Map(files.map(f => [f, textFor(f)]));
const rows = [];
for (const file of files) {
  let bestFile = '';
  let bestScore = 0;
  for (const other of files) {
    if (file === other) continue;
    const score = jaccard(vectors.get(file), vectors.get(other));
    if (score > bestScore) {
      bestScore = score;
      bestFile = other;
    }
  }
  rows.push({ file, nearest: bestFile, similarity: bestScore });
}

const csv = ['file,nearest,similarity', ...rows.map(r => `${r.file},${r.nearest},${r.similarity.toFixed(3)}`)].join('\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'docs', 'salarydecoded-cohort2-similarity.csv'), csv);

const risky = rows.filter(r => r.similarity >= 0.86);
const report = {
  pagesChecked: rows.length,
  highSimilarityThreshold: 0.86,
  highSimilarityPairs: risky.length,
  maxSimilarity: Math.max(...rows.map(r => r.similarity)).toFixed(3),
  examples: risky.slice(0, 12).map(r => ({ file: r.file, nearest: r.nearest, similarity: r.similarity.toFixed(3) })),
  advisory: true,
  note: 'This audit is a similarity warning report, not a blocking duplicate-signal test. Use scripts/audit-site.js for hard duplicate title, description, H1, canonical and crawl checks.'
};

fs.writeFileSync(path.join(ROOT, 'docs', 'salarydecoded-cohort2-similarity-summary.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
