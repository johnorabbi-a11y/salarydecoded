const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://salarydecoded.com';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!['scripts','docs','.git','node_modules'].includes(ent.name)) walk(p, out);
    } else if (ent.name === 'index.html') out.push(path.relative(ROOT, p).replace(/\\/g,'/'));
  }
  return out.sort();
}
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function routeFor(file) {
  if (file === 'index.html') return '';
  return file.replace(/\/index\.html$/, '');
}
function canonicalFor(route) { return `${SITE}/${route ? route.replace(/\/?$/, '/') : ''}`; }
function localForHref(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  if (/^https?:\/\//i.test(href)) {
    if (!href.startsWith(SITE)) return null;
    href = href.slice(SITE.length);
  }
  if (!href.startsWith('/')) return null;
  href = href.split('#')[0].split('?')[0];
  if (/\.[a-z0-9]{2,8}$/i.test(href)) return href.replace(/^\//, '');
  const route = href.replace(/^\/|\/$/g, '');
  return route ? `${route}/index.html` : 'index.html';
}
function percent(vals, p) {
  const a = vals.slice().sort((x,y)=>x-y);
  return a[Math.min(a.length-1, Math.floor((a.length-1)*p))] ?? 0;
}
const files = walk(ROOT);
const fileSet = new Set(files);
const issues = [];
const titles = new Map(), metas = new Map(), h1s = new Map(), canonicals = new Map();
const edges = new Map(files.map(f => [f, new Set()]));
for (const f of files) {
  const html = read(f);
  const route = routeFor(f);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1]?.trim();
  const canon = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]?.trim();
  const h1Count = [...html.matchAll(/<h1[\s\S]*?<\/h1>/gi)].length;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,'').trim();
  if (!title) issues.push([f,'missing title']); else (titles.get(title) || titles.set(title,[]).get(title)).push(f);
  if (!desc) issues.push([f,'missing meta description']); else (metas.get(desc) || metas.set(desc,[]).get(desc)).push(f);
  if (h1Count !== 1) issues.push([f,`h1 count ${h1Count}`]); else (h1s.get(h1) || h1s.set(h1,[]).get(h1)).push(f);
  if (canon !== canonicalFor(route)) issues.push([f,`canonical mismatch: ${canon}`]);
  (canonicals.get(canon) || canonicals.set(canon,[]).get(canon)).push(f);
  if (/\?[\d,]*\d{3}|�|Â£|â‚¬|ï¿½/.test(html)) issues.push([f,'suspicious currency/encoding artifact']);
  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(block[1]); } catch(e) { issues.push([f,`malformed JSON-LD: ${e.message}`]); }
  }
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const local = localForHref(m[1]);
    if (!local) continue;
    if (local.endsWith('/index.html')) {
      if (!fileSet.has(local)) issues.push([f,`broken internal link: ${m[1]}`]);
      else edges.get(f).add(local);
    } else if (!fs.existsSync(path.join(ROOT, local))) {
      issues.push([f,`broken asset link: ${m[1]}`]);
    }
  }
}
for (const [kind, map] of [['title',titles],['description',metas],['h1',h1s],['canonical',canonicals]]) {
  for (const [value, group] of map) if (group.length > 1) issues.push([group.join('; '),`duplicate ${kind}: ${value}`]);
}
const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const expectedUrls = files.map(f => canonicalFor(routeFor(f))).sort();
const sitemapSorted = sitemapUrls.slice().sort();
if (!/^<\?xml/.test(sitemap) || !/<urlset\b/.test(sitemap) || /<sitemapindex\b/.test(sitemap)) issues.push(['sitemap.xml','not a classic urlset']);
if (new Set(sitemapUrls).size !== sitemapUrls.length) issues.push(['sitemap.xml','duplicate sitemap URLs']);
if (JSON.stringify(expectedUrls) !== JSON.stringify(sitemapSorted)) issues.push(['sitemap.xml','sitemap/canonical inventory mismatch']);
const robots = fs.readFileSync(path.join(ROOT,'robots.txt'),'utf8');
if (!robots.includes('Sitemap: https://salarydecoded.com/sitemap.xml') || (robots.match(/Sitemap:/g)||[]).length !== 1) issues.push(['robots.txt','unexpected sitemap directives']);
const inbound = Object.fromEntries(files.map(f=>[f,0]));
for (const tos of edges.values()) for (const to of tos) inbound[to]++;
const depth = Object.fromEntries(files.map(f=>[f, Infinity]));
depth['index.html'] = 0;
const q = ['index.html'];
for (let i=0;i<q.length;i++) for (const to of edges.get(q[i]) || []) if (depth[to] === Infinity) { depth[to] = depth[q[i]] + 1; q.push(to); }
const finite = Object.values(depth).filter(Number.isFinite);
const orphans = files.filter(f => f !== 'index.html' && inbound[f] === 0);
const unreachable = files.filter(f => !Number.isFinite(depth[f]));
const report = {
  indexableUrls: files.length,
  sitemapUrls: sitemapUrls.length,
  reachable: finite.length,
  unreachable: unreachable.length,
  orphans: orphans.length,
  averageDepth: +(finite.reduce((a,b)=>a+b,0)/finite.length).toFixed(2),
  p95Depth: percent(finite, .95),
  maxDepth: Math.max(...finite),
  weakestLinkedPages: files.map(f=>({ file:f, inbound:inbound[f], depth:depth[f] })).sort((a,b)=>a.inbound-b.inbound || a.depth-b.depth).slice(0,12),
  issues: issues.map(([file, issue]) => ({ file, issue })),
  pass: issues.length === 0 && orphans.length === 0 && unreachable.length === 0 && percent(finite,.95) <= 3
};
fs.writeFileSync(path.join(ROOT,'docs','salarydecoded-crawl-graph.csv'), 'file,inbound,depth,outgoing\n' + files.map(f=>`${f},${inbound[f]},${depth[f]},${edges.get(f).size}`).join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exit(1);
