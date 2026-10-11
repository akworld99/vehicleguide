#!/usr/bin/env node
/* VehicleGuide static site generator. No dependencies.
   Usage: node build.js   (output goes to ./dist)
   Env:   BASE_PATH=/vehicleguide  SITE_URL=https://example.com  (both optional) */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const vehicles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vehicles.json'), 'utf8'));
const accessories = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/accessories.json'), 'utf8'));

const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const SITE = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, '');

const TYPES = [
  { slug: 'cars', name: 'Cars', one: 'car', icon: 'car' },
  { slug: 'suvs', name: 'SUVs and crossovers', one: 'SUV', icon: 'suv' },
  { slug: 'vans-and-pickups', name: 'Vans and pickups', one: 'van or pickup', icon: 'van' },
  { slug: 'motorbikes', name: 'Motorbikes', one: 'motorbike', icon: 'bike' },
  { slug: 'scooters', name: 'Scooters', one: 'scooter', icon: 'scooter' },
  { slug: 'three-wheelers', name: 'Three-wheelers', one: 'three-wheeler', icon: 'tuk' }
];
const typeBy = Object.fromEntries(TYPES.map(t => [t.slug, t]));

const ICONS = {
  car: '<path d="M6 30h4a5 5 0 0 0 10 0h20a5 5 0 0 0 10 0h5v-8l-3-2-8-1-7-7H20l-8 8-6 2z"/><path d="M22 15h7v5H17zM32 15h4l5 5h-9z" class="g"/>',
  suv: '<path d="M5 31h5a5 5 0 0 0 10 0h20a5 5 0 0 0 10 0h6V19l-5-1-6-8H16l-6 8-5 2z"/><path d="M18 13h9v6H14zM30 13h8l4 6H30z" class="g"/>',
  van: '<path d="M4 31h6a5 5 0 0 0 10 0h20a5 5 0 0 0 10 0h7V20l-8-10H4z"/><path d="M40 13h6l5 7H40zM8 13h12v7H8zM23 13h13v7H23z" class="g"/>',
  bike: '<circle cx="12" cy="29" r="7" class="w"/><circle cx="48" cy="29" r="7" class="w"/><path d="M12 29l9-11h10l5 6h8l4 5M36 24l-5 5H18M40 12h6l-3 12" class="l"/><path d="M19 15h13l-2 4H21z"/>',
  scooter: '<circle cx="13" cy="31" r="6" class="w"/><circle cx="47" cy="31" r="6" class="w"/><path d="M8 24h20l3 4h9l4-16h5" class="l"/><path d="M8 20h18v5H8zM28 28h13v4H20z"/>',
  tuk: '<circle cx="12" cy="31" r="5" class="w"/><circle cx="46" cy="31" r="5" class="w"/><path d="M5 30V19c0-6 5-10 12-10h24l11 13v8h-1a5 5 0 0 0-10 0H17a5 5 0 0 0-10 0z"/><path d="M36 12h4l8 10H36zM11 13h21v9H9c0-5 0-8 2-9z" class="g"/>'
};
const icon = (k, cls = '') => `<svg class="veh ${cls}" viewBox="0 0 60 40" aria-hidden="true" focusable="false">${ICONS[k]}</svg>`;

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const url = p => BASE + p;
const abs = p => SITE + p;
const fill = (t, v) => t.replace(/\{vehicle\}/g, v.full).replace(/\{make\}/g, v.make);
const lower1 = s => /^[A-Z][A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
const fitShort = a => a.fitTime.split(/,| for | including | with |\. | after /)[0];
const generic = t => t.replace(/^For (riding )?a \{vehicle\}, (\w)/, (m, r, c) => c.toUpperCase()).replace(/^For a \{vehicle\} in/, 'In').replace(/ on a \{vehicle\}/, '').replace(/a \{vehicle\}/g, 'an electric car').replace(/\{vehicle\}/g, 'vehicle');

vehicles.forEach(v => {
  v.full = `${v.make} ${v.model}`;
  v.slug = slugify(v.full);
  v.path = `/${v.type}/${v.slug}/`;
  v.typeInfo = typeBy[v.type];
  if (!v.typeInfo) throw new Error(`Unknown type "${v.type}" for ${v.full}`);
});
const fits = (a, v) =>
  a.for.some(t => v.tags.includes(t)) &&
  (a.requires || []).every(t => v.tags.includes(t)) &&
  !(a.excludes || []).some(t => v.tags.includes(t));
vehicles.forEach(v => { v.acc = accessories.filter(a => fits(a, v)); });
accessories.forEach(a => { a.path = `/accessories/${a.slug}/`; a.vehicles = vehicles.filter(v => fits(a, v)); });

const priceText = a => (a.priceMin && a.priceMax)
  ? `Rs. ${a.priceMin.toLocaleString('en-LK')} to Rs. ${a.priceMax.toLocaleString('en-LK')} fitted`
  : null;

const waText = (v, a) => {
  let t = 'Hi VehicleGuide, I would like 3 quotes';
  if (a) t += ` for ${lower1(a.name)}`;
  if (v) t += ` for my ${v.full}`;
  return t + '. My area: ';
};
const waLink = text => `https://wa.me/${cfg.whatsapp || ''}?text=${encodeURIComponent(text)}`;

const pages = [];
function write(p, html) {
  const file = path.join(OUT, p, p.endsWith('.html') ? '' : 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const crumbsLd = crumbs => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: abs(c[1]) }))
});
const faqLd = faqs => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
});
const pageLd = (p, title, desc) => ({
  '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: abs(p),
  inLanguage: 'en-LK', dateModified: cfg.updated,
  isPartOf: { '@type': 'WebSite', name: cfg.name, url: SITE + '/' },
  publisher: { '@type': 'Organization', name: cfg.name, url: SITE + '/' }
});

function layout({ p, title, desc, crumbs, body, schema = [], noindex = false }) {
  if (!noindex) pages.push(p);
  const all = [pageLd(p, title, desc), ...schema];
  if (crumbs && crumbs.length > 1) all.push(crumbsLd(crumbs));
  const ga = cfg.ga4 ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.ga4)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.ga4)}');</script>` : '';
  return `<!doctype html>
<html lang="en-LK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${abs(p)}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(p)}">
<meta property="og:locale" content="en_LK">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#FFD21F">
<link rel="icon" href="${url('/favicon.svg')}" type="image/svg+xml">
<link rel="preload" href="${url('/assets/fonts/barlow-condensed-latin-700-normal.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${url('/assets/fonts/barlow-latin-400-normal.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${url('/assets/styles.css')}">
${all.map(ld).join('\n')}
${ga}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap top-in">
    <a class="plate-logo" href="${url('/')}" aria-label="${esc(cfg.name)} home"><span>VEHICLE</span><span>GUIDE</span></a>
    <nav aria-label="Main">
      <a href="${url('/vehicles/')}">Vehicles</a>
      <a href="${url('/accessories/')}">Accessories</a>
      <a href="${url('/how-it-works/')}">How it works</a>
      <a href="${url('/for-shops/')}">For shops</a>
    </nav>
    <a class="btn btn-go btn-sm" data-wa href="${waLink(waText())}" rel="nofollow noopener">Get 3 quotes</a>
  </div>
</header>
${crumbs && crumbs.length > 1 ? `<nav class="crumbs wrap" aria-label="Breadcrumb"><ol>${crumbs.map((c, i) => i === crumbs.length - 1 ? `<li aria-current="page">${esc(c[0])}</li>` : `<li><a href="${url(c[1])}">${esc(c[0])}</a></li>`).join('')}</ol></nav>` : ''}
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <a class="plate-logo" href="${url('/')}"><span>VEHICLE</span><span>GUIDE</span></a>
      <p>An independent guide to vehicle accessories in Sri Lanka. We are not a shop and we are not affiliated with any vehicle manufacturer. Quotes come from independent fitters.</p>
    </div>
    <div>
      <h2>Browse</h2>
      <ul>${TYPES.map(t => `<li><a href="${url(`/${t.slug}/`)}">${t.name}</a></li>`).join('')}<li><a href="${url('/electric-vehicles/')}">Electric vehicles</a></li></ul>
    </div>
    <div>
      <h2>Accessories</h2>
      <ul>${accessories.slice(0, 8).map(a => `<li><a href="${url(a.path)}">${esc(a.plural)}</a></li>`).join('')}<li><a href="${url('/accessories/')}">All accessories</a></li></ul>
    </div>
    <div>
      <h2>VehicleGuide</h2>
      <ul>
        <li><a href="${url('/how-it-works/')}">How it works</a></li>
        <li><a href="${url('/for-shops/')}">List your shop</a></li>
        <li><a href="${url('/about/')}">About and sources</a></li>
        <li><a href="${url('/privacy/')}">Privacy</a></li>
      </ul>
    </div>
  </div>
  <p class="wrap fine">Guides last reviewed ${esc(cfg.updatedLabel)}. Registration figures are from JB Securities data as reported in the press. Vehicle names are trademarks of their owners.</p>
</footer>
<script>window.VG=${JSON.stringify({ wa: cfg.whatsapp || '', lead: cfg.leadEndpoint || '', base: BASE })};</script>
<script src="${url('/assets/app.js')}" defer></script>
</body>
</html>`;
}

// ---------- shared blocks ----------
const quoteForm = (v, a, heading) => `
<form class="quote" data-quote${v ? ` data-vehicle="${esc(v.full)}"` : ''}${a ? ` data-need="${esc(a.name)}"` : ''} action="#">
  <h2>${esc(heading || 'Get 3 fitted prices on WhatsApp')}</h2>
  <p>Tell us where you are. We ask fitters near you and send back three quotes, usually within a day. Free, and you deal with the shop you choose.</p>
  ${v ? '' : `<label>Your vehicle<input name="vehicle" autocomplete="off" placeholder="e.g. Toyota Raize 2022" required></label>`}
  ${a ? '' : `<label>What you need<input name="need" autocomplete="off" placeholder="e.g. dashcam, seat covers"></label>`}
  <label>Your town or area<input name="area" autocomplete="address-level2" placeholder="e.g. Dehiwala" required></label>
  <button class="btn btn-go" type="submit">Send on WhatsApp</button>
  <noscript><p><a class="btn btn-go" href="${waLink(waText(v, a))}" rel="nofollow noopener">Open WhatsApp</a></p></noscript>
  <p class="fine">Opens WhatsApp with your request filled in. We only use your number to reply.</p>
</form>`;

const faqBlock = (faqs, heading = 'Common questions') => `
<section class="faq">
  <h2>${esc(heading)}</h2>
  ${faqs.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n  ')}
</section>`;

const vehRow = v => `<li><a class="row" href="${url(v.path)}">${icon(v.typeInfo.icon)}<span class="row-main"><strong>${esc(v.full)}</strong><span>${esc(v.body)}, ${esc(lower1(v.power))}</span></span><span class="row-meta">${v.acc.length} guides</span></a></li>`;
const vehList = list => `<ul class="rows">${list.map(vehRow).join('')}</ul>`;

// ---------- money page: vehicle x accessory ----------
function moneyPage(v, a) {
  const p = `${v.path}${a.slug}/`;
  const price = priceText(a);
  const title = `${a.name} for ${v.full} in Sri Lanka: Price & Fitting`;
  const desc = `${a.name} for the ${v.full}: what to check, fitting time and what drives the price in Sri Lanka. Get three fitted quotes on WhatsApp.`;
  const notes = Object.entries(a.notes || {}).filter(([tag]) => v.tags.includes(tag)).map(([, t]) => t);
  const faqs = a.faqs.map(f => ({ q: fill(f.q, v), a: fill(f.a, v) }));
  faqs.unshift({
    q: `${a.name} price for a ${v.full} in Sri Lanka: what should I expect to pay?`,
    a: price
      ? `Expect ${price}. The final figure depends on ${a.costDrivers.slice(0, 3).map(lower1).join(', ')}.`
      : `It depends mainly on ${a.costDrivers.slice(0, 3).map(lower1).join(', ')}. Prices move with import costs and exchange rates, so we collect live quotes instead of publishing a figure that goes stale. Ask on WhatsApp and we send three current prices.`
  });
  const others = v.acc.filter(x => x !== a);
  const sameType = a.vehicles.filter(x => x !== v && x.type === v.type).slice(0, 8);
  const body = `
<article class="wrap page">
  <div class="cols">
    <div class="main">
      <p class="kicker">${icon(v.typeInfo.icon)}<span class="plate-tag">${esc(v.full)}</span></p>
      <h1>${esc(a.name)} for ${esc(v.full)} in Sri Lanka</h1>
      <div class="answer">
        <p>${esc(fill(a.answer, v))}</p>
      </div>
      <table class="facts">
        <caption>Quick facts</caption>
        <tr><th scope="row">Price</th><td>${price ? esc(price) : `Quoted on request. <a data-wa href="${waLink(waText(v, a))}" rel="nofollow noopener">Ask for today's price</a>`}</td></tr>
        <tr><th scope="row">Fitting time</th><td>${esc(a.fitTime)}</td></tr>
        <tr><th scope="row">Where it is done</th><td>${esc(a.fittedAt)}</td></tr>
        <tr><th scope="row">Vehicle</th><td>${esc(v.full)}, ${esc(lower1(v.body))}, ${esc(lower1(v.power))}</td></tr>
        <tr><th scope="row">Reviewed</th><td><time datetime="${cfg.updated}">${esc(cfg.updatedLabel)}</time></td></tr>
      </table>

      ${notes.length ? `<section><h2>What is specific to the ${esc(v.full)}</h2>${notes.map(n => `<p>${esc(n)}</p>`).join('')}</section>` : ''}

      <section>
        <h2>What to check before you pay</h2>
        <ul class="checks">${a.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </section>

      <section>
        <h2>What changes the price</h2>
        <p>Quotes for the same job can differ a lot between shops. These are the things that move the number:</p>
        <ul>${a.costDrivers.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </section>

      ${faqBlock(faqs, `${a.name} for ${v.full}: common questions`)}

      <section>
        <h2>About the ${esc(v.full)} in Sri Lanka</h2>
        <p>${esc(v.note)} <span class="src">Source: ${esc(v.source)}.</span></p>
        <p><a href="${url(v.path)}">All accessory guides for the ${esc(v.full)}</a></p>
      </section>
    </div>
    <aside class="side">
      ${quoteForm(v, a, `Get 3 prices for your ${v.full}`)}
      ${others.length ? `<div class="box"><h2>More for the ${esc(v.full)}</h2><ul class="links">${others.map(x => `<li><a href="${url(v.path + x.slug + '/')}">${esc(x.name)}</a></li>`).join('')}</ul></div>` : ''}
      ${sameType.length ? `<div class="box"><h2>${esc(a.plural)} for other ${esc(lower1(v.typeInfo.name))}</h2><ul class="links">${sameType.map(x => `<li><a href="${url(x.path + a.slug + '/')}">${esc(x.full)}</a></li>`).join('')}</ul></div>` : ''}
    </aside>
  </div>
</article>`;
  write(p, layout({
    p, title, desc, body,
    crumbs: [['Home', '/'], [v.typeInfo.name, `/${v.type}/`], [v.full, v.path], [a.name, p]],
    schema: [faqLd(faqs)]
  }));
}

// ---------- vehicle hub ----------
function vehiclePage(v) {
  const title = `${v.full} Accessories in Sri Lanka: Guides & Prices`;
  const desc = `Accessory guides for the ${v.full} in Sri Lanka: ${v.acc.slice(0, 4).map(a => lower1(a.name)).join(', ')} and more. What to check, fitting times and three quotes on WhatsApp.`;
  const siblings = vehicles.filter(x => x.type === v.type && x !== v);
  const faqs = [
    { q: `Which accessories do ${v.full} owners in Sri Lanka fit first?`, a: `The most common first additions are ${v.acc.slice(0, 3).map(a => lower1(a.name)).join(', ')}. Each guide on this page explains what to check and how long fitting takes.` },
    { q: `Do accessories affect the warranty on a ${v.full}?`, a: v.tags.includes('new') || v.tags.includes('ev')
        ? `They can, if the work involves the vehicle's wiring. Ask the agent before any electrical accessory is fitted, use a fitter who works with plug-in harnesses instead of cutting wires, and keep the invoice.`
        : `Most ${v.full}s here are sold without a manufacturer warranty, so the question is usually the importer's or dealer's own cover. Ask them before electrical work, and choose a fitter who does not cut the original wiring.` },
    { q: `How do I get prices for ${v.full} accessories?`, a: `Send us your area on WhatsApp with what you need. We ask fitters near you and return three quotes, usually within a day. The service is free for vehicle owners.` }
  ];
  const body = `
<article class="wrap page">
  <div class="cols">
    <div class="main">
      <p class="kicker">${icon(v.typeInfo.icon)}<span class="plate-tag">${esc(v.typeInfo.name)}</span></p>
      <h1>${esc(v.full)} accessories in Sri Lanka</h1>
      <div class="answer"><p>${v.acc.length} guides for the ${esc(v.full)}, each with what to check, how long fitting takes and what changes the price. ${esc(v.note)}</p></div>
      <table class="facts">
        <caption>The ${esc(v.full)} at a glance</caption>
        <tr><th scope="row">Body</th><td>${esc(v.body)}</td></tr>
        <tr><th scope="row">Power</th><td>${esc(v.power)}</td></tr>
        <tr><th scope="row">How it is sold here</th><td>${esc(v.market)}</td></tr>
        <tr><th scope="row">Popularity</th><td>${esc(v.note)} <span class="src">Source: ${esc(v.source)}.</span></td></tr>
      </table>
      <section>
        <h2>Accessory guides for the ${esc(v.full)}</h2>
        <ul class="rows">
          ${v.acc.map(a => `<li><a class="row" href="${url(v.path + a.slug + '/')}"><span class="row-main"><strong>${esc(a.name)}</strong><span>${esc(a.summary)}</span></span><span class="row-meta">${esc(fitShort(a))}</span></a></li>`).join('\n          ')}
        </ul>
      </section>
      ${faqBlock(faqs, `${v.full} accessories: common questions`)}
      ${siblings.length ? `<section><h2>Other ${esc(lower1(v.typeInfo.name))}</h2>${vehList(siblings)}</section>` : ''}
    </div>
    <aside class="side">${quoteForm(v, null, `Get 3 prices for your ${v.full}`)}</aside>
  </div>
</article>`;
  write(v.path, layout({
    p: v.path, title, desc, body,
    crumbs: [['Home', '/'], [v.typeInfo.name, `/${v.type}/`], [v.full, v.path]],
    schema: [faqLd(faqs)]
  }));
}

// ---------- type hub ----------
function typePage(t) {
  const list = vehicles.filter(v => v.type === t.slug);
  const accs = accessories.filter(a => list.some(v => v.acc.includes(a)));
  const p = `/${t.slug}/`;
  const title = `${t.name}: Accessory Guides and Fitted Prices in Sri Lanka`;
  const desc = `Accessory guides for popular ${lower1(t.name)} in Sri Lanka, including ${list.slice(0, 3).map(v => v.full).join(', ')}. Compare what to check and get three quotes on WhatsApp.`;
  const body = `
<section class="wrap page">
  <p class="kicker">${icon(t.icon)}</p>
  <h1>${esc(t.name)}: accessory guides for Sri Lanka</h1>
  <p class="lede">Pick your ${esc(t.one)} to see the accessories that fit it, what to check before paying and how to get three fitted prices.</p>
  ${vehList(list)}
  <h2>Accessories for ${esc(lower1(t.name))}</h2>
  <ul class="chips">${accs.map(a => `<li><a href="${url(a.path)}">${esc(a.plural)}</a></li>`).join('')}</ul>
  <div class="narrow">${quoteForm(null, null, `Don't see your ${t.one}?`)}</div>
</section>`;
  write(p, layout({ p, title, desc, body, crumbs: [['Home', '/'], [t.name, p]] }));
}

// ---------- accessory guide ----------
function accessoryPage(a) {
  const title = `${a.plural} in Sri Lanka: Buying Guide, Fitting and Prices`;
  const desc = `${a.summary} What to check, fitting time and what changes the price in Sri Lanka, with guides for ${a.vehicles.length} popular vehicles.`;
  const faqs = a.faqs.map(f => ({ q: f.q.replace(/\{vehicle\}/g, 'vehicle'), a: f.a.replace(/\{vehicle\}/g, 'vehicle') }));
  const price = priceText(a);
  const groups = TYPES.map(t => [t, a.vehicles.filter(v => v.type === t.slug)]).filter(g => g[1].length);
  const body = `
<article class="wrap page">
  <div class="cols">
    <div class="main">
      <h1>${esc(a.plural)} in Sri Lanka: what to buy and what to check</h1>
      <div class="answer"><p>${esc(a.summary)} ${esc(generic(a.answer))}</p></div>
      <table class="facts">
        <caption>Quick facts</caption>
        <tr><th scope="row">Price</th><td>${price ? esc(price) : `Quoted on request. <a data-wa href="${waLink(waText(null, a))}" rel="nofollow noopener">Ask for today's price</a>`}</td></tr>
        <tr><th scope="row">Fitting time</th><td>${esc(a.fitTime)}</td></tr>
        <tr><th scope="row">Where it is done</th><td>${esc(a.fittedAt)}</td></tr>
        <tr><th scope="row">Reviewed</th><td><time datetime="${cfg.updated}">${esc(cfg.updatedLabel)}</time></td></tr>
      </table>
      <section><h2>What to check before you pay</h2><ul class="checks">${a.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
      <section><h2>What changes the price</h2><ul>${a.costDrivers.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
      <section>
        <h2>${esc(a.plural)} by vehicle</h2>
        ${groups.map(([t, list]) => `<h3>${esc(t.name)}</h3><ul class="chips">${list.map(v => `<li><a href="${url(v.path + a.slug + '/')}">${esc(v.full)}</a></li>`).join('')}</ul>`).join('')}
      </section>
      ${faqBlock(faqs, `${a.plural}: common questions`)}
    </div>
    <aside class="side">${quoteForm(null, a, `Get 3 prices for ${lower1(a.plural)}`)}</aside>
  </div>
</article>`;
  write(a.path, layout({
    p: a.path, title, desc, body,
    crumbs: [['Home', '/'], ['Accessories', '/accessories/'], [a.plural, a.path]],
    schema: [faqLd(faqs)]
  }));
}

// ---------- index pages ----------
function homePage() {
  const title = `${cfg.name}: Vehicle Accessory Guides and Fitted Prices in Sri Lanka`;
  const desc = `Find the right accessories for your car, SUV, van, motorbike, scooter or three-wheeler in Sri Lanka. Model-by-model guides and three fitted quotes on WhatsApp.`;
  const pick = vehicles.map(v => ({ n: v.full, t: v.type, p: v.path, a: v.acc.map(a => [a.slug, a.name]) }));
  const faqs = [
    { q: 'What is VehicleGuide?', a: 'VehicleGuide is an independent guide to vehicle accessories in Sri Lanka. We publish model-by-model advice on what to fit and what to check, and we collect quotes from fitters on your behalf.' },
    { q: 'Is the quote service free?', a: 'Yes. Vehicle owners pay nothing. Shops that join our network pay us when a job comes through, which never changes the price you are quoted.' },
    { q: 'Do you sell or fit accessories yourselves?', a: 'No. We are a guide, not a shop. The fitting is done by independent accessory shops and fitters, and you pay them directly.' },
    { q: 'Which vehicles do you cover?', a: `We started with ${vehicles.length} of the most registered cars, SUVs, vans, pickups, motorbikes, scooters and three-wheelers in Sri Lanka in 2026, and we add more every month. If yours is not listed, message us and we will still get you quotes.` }
  ];
  const body = `
<section class="hero">
  <div class="wrap hero-in">
    <div>
      <h1>Know what to fit, and what it should cost, before you walk into the shop.</h1>
      <p class="lede">Accessory guides for the vehicles Sri Lanka drives, written model by model. Tell us what you drive and we send three fitted prices from shops near you on WhatsApp.</p>
    </div>
    <form class="picker" data-picker action="${url('/vehicles/')}">
      <div class="picker-plate">
        <label>I drive a
          <select name="type" data-type>
            <option value="">Choose type</option>
            ${TYPES.map(t => `<option value="${t.slug}">${esc(t.one.charAt(0).toUpperCase() + t.one.slice(1))}</option>`).join('')}
          </select>
        </label>
        <label>Model
          <select name="vehicle" data-vehicle disabled><option value="">Choose model</option></select>
        </label>
        <label>I need
          <select name="need" data-need disabled><option value="">Everything for it</option></select>
        </label>
      </div>
      <button class="btn btn-dark" type="submit">Show the guide</button>
      <p class="fine">${vehicles.length} vehicles and ${accessories.length} accessory types so far. <a data-wa href="${waLink(waText())}" rel="nofollow noopener">Not listed? Ask us on WhatsApp.</a></p>
    </form>
  </div>
</section>

<section class="wrap block">
  <h2>Browse by vehicle type</h2>
  <ul class="types">
    ${TYPES.map(t => `<li><a href="${url(`/${t.slug}/`)}">${icon(t.icon)}<strong>${esc(t.name)}</strong><span>${vehicles.filter(v => v.type === t.slug).length} models</span></a></li>`).join('\n    ')}
  </ul>
</section>

<section class="wrap block split">
  <div>
    <h2>The vehicles people are registering now</h2>
    <p>Our launch list follows 2026 registration data, so the guides cover what is on the road today.</p>
    ${vehList(['byd-atto-1', 'toyota-raize', 'suzuki-wagon-r', 'honda-vezel', 'honda-dio', 'bajaj-re'].map(s => vehicles.find(v => v.slug === s)).filter(Boolean))}
    <p><a class="more" href="${url('/vehicles/')}">See all ${vehicles.length} vehicles</a></p>
  </div>
  <div>
    <h2>Accessory guides</h2>
    <p>Each guide answers what to buy, what to check and what moves the price.</p>
    <ul class="rows">
      ${accessories.slice(0, 6).map(a => `<li><a class="row" href="${url(a.path)}"><span class="row-main"><strong>${esc(a.plural)}</strong><span>${esc(a.summary)}</span></span></a></li>`).join('\n      ')}
    </ul>
    <p><a class="more" href="${url('/accessories/')}">See all ${accessories.length} accessory guides</a></p>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2>How the three-quote service works</h2>
    <ol class="steps">
      <li><strong>Tell us your vehicle and area.</strong> One WhatsApp message. No sign-up, no app.</li>
      <li><strong>We ask fitters near you.</strong> We send your request to accessory shops and fitters and collect their prices.</li>
      <li><strong>You get three quotes.</strong> Usually within a day. Choose one and deal with the shop directly.</li>
    </ol>
    <a class="btn btn-go" data-wa href="${waLink(waText())}" rel="nofollow noopener">Get 3 quotes on WhatsApp</a>
  </div>
</section>

<section class="wrap block narrow">
  ${faqBlock(faqs, 'About VehicleGuide')}
</section>
<script type="application/json" id="pick-data">${JSON.stringify(pick).replace(/</g, '\\u003c')}</script>`;
  write('/', layout({
    p: '/', title, desc, body,
    schema: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: cfg.name, url: SITE + '/', description: cfg.tagline, areaServed: { '@type': 'Country', name: 'Sri Lanka' } },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.name, url: SITE + '/', inLanguage: 'en-LK' },
      faqLd(faqs)
    ]
  }));
}

function vehiclesIndex() {
  const p = '/vehicles/';
  const body = `
<section class="wrap page">
  <h1>All vehicles</h1>
  <p class="lede">${vehicles.length} of the most registered vehicles in Sri Lanka in 2026. Choose yours to see its accessory guides.</p>
  <label class="search">Find your vehicle<input type="search" data-filter placeholder="Type a make or model, e.g. Raize"></label>
  <p class="empty" data-empty hidden>No match yet. <a data-wa href="${waLink(waText())}" rel="nofollow noopener">Message us on WhatsApp</a> and we will still get you quotes.</p>
  ${TYPES.map(t => `<section data-group><h2>${esc(t.name)}</h2>${vehList(vehicles.filter(v => v.type === t.slug))}</section>`).join('')}
</section>`;
  write(p, layout({
    p, body, crumbs: [['Home', '/'], ['Vehicles', p]],
    title: 'All Vehicles: Accessory Guides by Make and Model in Sri Lanka',
    desc: `Accessory guides for ${vehicles.length} popular vehicles in Sri Lanka, from the BYD Atto 1 and Toyota Raize to the Honda Dio and Bajaj RE.`,
    schema: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: vehicles.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: v.full, url: abs(v.path) })) }]
  }));
}

function evPage() {
  const p = '/electric-vehicles/';
  const list = vehicles.filter(v => v.tags.includes('ev'));
  const charger = accessories.find(a => a.slug === 'ev-home-charger');
  const faqs = charger.faqs.map(f => ({ q: f.q.replace(/ my \{vehicle\}/g, ' an electric car').replace(/\{vehicle\}/g, 'electric car'), a: f.a }));
  const body = `
<section class="wrap page">
  <h1>Electric vehicles: accessories and home charging in Sri Lanka</h1>
  <p class="lede">Electric cars and scooters need the same everyday accessories as any vehicle, with two differences: electrical work must stay on the 12V system, and home charging needs planning.</p>
  ${vehList(list)}
  <h2>Home charging</h2>
  <p>${esc(charger.summary)} ${esc(charger.notes.ev)}</p>
  <p><a class="more" href="${url(charger.path)}">Read the EV home charger guide</a></p>
  <div class="narrow">${faqBlock(faqs, 'Electric vehicle charging: common questions')}${quoteForm(null, null, 'Get 3 prices for your electric vehicle')}</div>
</section>`;
  write(p, layout({
    p, body, crumbs: [['Home', '/'], ['Electric vehicles', p]], schema: [faqLd(faqs)],
    title: 'Electric Vehicle Accessories and Home Charging in Sri Lanka',
    desc: `Accessory and home charging guides for electric vehicles in Sri Lanka, including ${list.slice(0, 3).map(v => v.full).join(', ')}.`
  }));
}

function accessoriesIndex() {
  const p = '/accessories/';
  const body = `
<section class="wrap page">
  <h1>Accessory guides</h1>
  <p class="lede">What to buy, what to check and what changes the price, for ${accessories.length} of the most-fitted accessories in Sri Lanka.</p>
  <ul class="rows">
    ${accessories.map(a => `<li><a class="row" href="${url(a.path)}"><span class="row-main"><strong>${esc(a.plural)}</strong><span>${esc(a.summary)}</span></span><span class="row-meta">${a.vehicles.length} vehicles</span></a></li>`).join('\n    ')}
  </ul>
</section>`;
  write(p, layout({
    p, body, crumbs: [['Home', '/'], ['Accessories', p]],
    title: 'Vehicle Accessory Guides for Sri Lanka: What to Buy and Check',
    desc: 'Buying guides for dashcams, window tint, ceramic coating, seat covers, GPS trackers, helmets and more, written for Sri Lankan roads and weather.'
  }));
}

function staticPages() {
  const simple = (p, title, desc, name, html, extra = {}) => write(p, layout({
    p, title, desc, crumbs: [['Home', '/'], [name, p]], body: `<article class="wrap page prose">${html}</article>`, ...extra
  }));

  simple('/how-it-works/', 'How VehicleGuide Works: Three Fitted Quotes on WhatsApp',
    'How the free VehicleGuide quote service works: send your vehicle and area on WhatsApp and get three fitted prices from shops near you.', 'How it works', `
  <h1>How it works</h1>
  <p class="lede">You read the guide, we do the ringing around. The service is free for vehicle owners.</p>
  <ol class="steps">
    <li><strong>Send one message.</strong> Tell us your vehicle, what you need and your town. A photo of the vehicle helps for body and trim work.</li>
    <li><strong>We collect prices.</strong> We contact accessory shops and fitters that handle your kind of vehicle and ask each for a fitted price.</li>
    <li><strong>You get three quotes.</strong> Each one shows the product, the fitted price, the warranty and where the shop is. This usually takes less than a day.</li>
    <li><strong>You choose.</strong> Book with the shop directly and pay them. Tell them VehicleGuide sent you.</li>
  </ol>
  <h2>What it costs</h2>
  <p>Nothing for you. Shops in our network pay us a fee when a job comes through. We send you the prices exactly as the shops give them.</p>
  <h2>What we do not do</h2>
  <p>We do not sell, stock or fit anything, and we do not take payment from vehicle owners. Workmanship and warranty are between you and the shop you choose, so ask for a written invoice.</p>
  ${quoteForm(null, null)}`);

  simple('/for-shops/', 'For Accessory Shops and Fitters: Get Customers from VehicleGuide',
    'Accessory shops, tint studios, detailers and fitters in Sri Lanka: receive ready-to-buy customer requests from VehicleGuide. First month free.', 'For shops', `
  <h1>Accessory shop or fitter? We send you customers.</h1>
  <p class="lede">Vehicle owners search for accessories by model, read our guides and ask us for prices. We pass each request to shops that can do the job.</p>
  <h2>How it works for you</h2>
  <ol class="steps">
    <li><strong>We send a request.</strong> Vehicle, accessory and the customer's area, on WhatsApp.</li>
    <li><strong>You reply with a fitted price.</strong> Product, price, warranty and when you can do it.</li>
    <li><strong>The customer chooses.</strong> If they pick you, they come to your shop and pay you directly.</li>
  </ol>
  <h2>What it costs</h2>
  <p>The first month is free while you see the quality of the requests. After that we agree a simple fee per completed job. There is no listing fee and no contract.</p>
  <h2>Who we are looking for</h2>
  <ul>
    <li>Car accessory shops, audio and Android player fitters</li>
    <li>Tint studios and detailing or ceramic coating studios</li>
    <li>Seat cover and upholstery workshops</li>
    <li>Motorbike and three-wheeler accessory shops</li>
    <li>Auto electricians, GPS tracker installers and EV charger electricians</li>
  </ul>
  <p><a class="btn btn-go" data-wa href="${waLink('Hi VehicleGuide, I run an accessory shop and would like to receive customer requests. Shop name and town: ')}" rel="nofollow noopener">List my shop on WhatsApp</a></p>`);

  simple('/about/', 'About VehicleGuide and Our Sources',
    'Who is behind VehicleGuide, how the guides are written, and where the vehicle registration figures come from.', 'About', `
  <h1>About VehicleGuide</h1>
  <p class="lede">VehicleGuide is an independent guide to vehicle accessories in Sri Lanka, based in Colombo.</p>
  <p>Vehicle imports reopened in 2025 and hundreds of thousands of new and reconditioned vehicles have been registered since. Many are models that were not sold here before, and good local advice on what to fit to them is hard to find. We write that advice model by model and help owners get fair fitted prices.</p>
  <h2>How the guides are written</h2>
  <p>Each guide explains what the accessory does, what to check before paying, how long fitting takes and what changes the price. Where a point is specific to a type of vehicle, such as an electric car or a reconditioned Japanese import, we say so. We do not publish a price unless we have current quotes to support it.</p>
  <h2>Where the figures come from</h2>
  <p>Popularity notes use monthly vehicle registration analysis by JB Securities, as reported by Daily FT, Daily Mirror, Hiru News and Outlook Business during 2026. The source is shown beside each figure.</p>
  <h2>Independence</h2>
  <p>We are not affiliated with any vehicle manufacturer, agent or importer. Shops in our network pay a fee when a job comes through. Guides are written before, and separately from, any commercial arrangement.</p>
  <h2>Corrections</h2>
  <p>If something here is wrong or out of date, tell us and we will fix it. <a data-wa href="${waLink('Hi VehicleGuide, I have a correction: ')}" rel="nofollow noopener">Message us on WhatsApp</a>.</p>`);

  simple('/privacy/', 'Privacy: How VehicleGuide Uses Your Details',
    'What VehicleGuide collects when you ask for quotes, how it is used and how to have it removed.', 'Privacy', `
  <h1>Privacy</h1>
  <p class="lede">We collect as little as we need to get you quotes.</p>
  <h2>What we collect</h2>
  <p>When you ask for quotes, you send us a WhatsApp message with your vehicle, what you need and your area. We see your WhatsApp number and name as with any chat.</p>
  <h2>How we use it</h2>
  <p>We pass your vehicle, the accessory and your area to shops so they can price the job. We share your phone number with a shop only when you tell us which quote you want to take.</p>
  <h2>Analytics</h2>
  <p>We may use basic website analytics to count page visits. This does not identify you personally.</p>
  <h2>Removing your details</h2>
  <p>Message us and we will delete your chat and any record of your request.</p>`);

  write('/404.html', layout({
    p: '/404.html', noindex: true, title: 'Page not found | VehicleGuide', desc: 'This page does not exist.',
    body: `<section class="wrap page prose"><h1>That page is not here</h1><p class="lede">The address may have changed. Find your vehicle from the full list, or ask us directly.</p><p><a class="btn btn-dark" href="${url('/vehicles/')}">See all vehicles</a></p></section>`
  }));
}

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets/fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'src/fonts'))) fs.copyFileSync(path.join(ROOT, 'src/fonts', f), path.join(OUT, 'assets/fonts', f));
fs.copyFileSync(path.join(ROOT, 'src/styles.css'), path.join(OUT, 'assets/styles.css'));
fs.copyFileSync(path.join(ROOT, 'src/app.js'), path.join(OUT, 'assets/app.js'));
fs.writeFileSync(path.join(OUT, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="1.5" y="6.5" width="29" height="19" rx="3" fill="#FFD21F" stroke="#1B222B" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="12" fill="#1B222B">VG</text></svg>');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

homePage();
vehiclesIndex();
accessoriesIndex();
evPage();
TYPES.forEach(typePage);
accessories.forEach(accessoryPage);
vehicles.forEach(v => { vehiclePage(v); v.acc.forEach(a => moneyPage(v, a)); });
staticPages();

fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `<url><loc>${abs(p)}</loc><lastmod>${cfg.updated}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# AI answer engines are welcome to read and cite these guides\n${['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'].map(b => `User-agent: ${b}\nAllow: /\n`).join('\n')}\nSitemap: ${abs('/sitemap.xml')}\n`);
fs.writeFileSync(path.join(OUT, 'llms.txt'),
  `# ${cfg.name}\n\n> ${cfg.tagline}. Independent, model-by-model accessory guides for Sri Lanka, with a free service that collects three fitted quotes from local shops on WhatsApp. Reviewed ${cfg.updatedLabel}.\n\n## Accessory guides\n${accessories.map(a => `- [${a.plural}](${abs(a.path)}): ${a.summary}`).join('\n')}\n\n## Vehicles\n${vehicles.map(v => `- [${v.full}](${abs(v.path)}): ${v.body}, ${lower1(v.power)}. ${v.note}`).join('\n')}\n\n## About\n- [How it works](${abs('/how-it-works/')})\n- [About and sources](${abs('/about/')})\n- [For accessory shops](${abs('/for-shops/')})\n`);

const money = vehicles.reduce((n, v) => n + v.acc.length, 0);
console.log(`Built ${pages.length} pages: ${vehicles.length} vehicles, ${accessories.length} accessories, ${money} vehicle x accessory pages.`);
if (!cfg.whatsapp) console.warn('WARNING: site.config.json has no "whatsapp" number. Quote buttons open WhatsApp without a recipient until you set it (format: 9477XXXXXXX).');
const unpriced = accessories.filter(a => !priceText(a)).length;
if (unpriced) console.warn(`NOTE: ${unpriced} of ${accessories.length} accessories have no price range yet. Pages show "Quoted on request" until priceMin/priceMax are filled in data/accessories.json.`);
