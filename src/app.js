/* VehicleGuide front-end: vehicle picker, quote form to WhatsApp, list filter, lead tracking. */
(function () {
  var VG = window.VG || {};

  function track(kind, detail) {
    var data = { kind: kind, page: location.pathname, detail: detail || '', time: new Date().toISOString() };
    try { if (window.gtag) window.gtag('event', 'generate_lead', { method: 'whatsapp', lead_kind: kind, page_path: data.page, detail: data.detail }); } catch (e) {}
    try {
      if (VG.lead && navigator.sendBeacon) navigator.sendBeacon(VG.lead, new Blob([JSON.stringify(data)], { type: 'text/plain' }));
    } catch (e) {}
  }
  function wa(text) { return 'https://wa.me/' + (VG.wa || '') + '?text=' + encodeURIComponent(text); }

  // Plain WhatsApp links: add the page reference so every lead can be traced to a page.
  document.querySelectorAll('a[data-wa]').forEach(function (a) {
    a.addEventListener('click', function () { track('link', a.textContent.trim()); });
    try {
      var u = new URL(a.href);
      var t = u.searchParams.get('text') || '';
      if (t.indexOf('(Ref:') === -1) { u.searchParams.set('text', t + ' (Ref: ' + location.pathname + ')'); a.href = u.toString(); }
    } catch (e) {}
  });

  // Outbound clicks to listed shops: the record that proves what the site sends them.
  document.querySelectorAll('a[data-shop]').forEach(function (a) {
    a.addEventListener('click', function () {
      var shop = a.dataset.shop, acc = a.dataset.acc || '';
      try { if (window.gtag) window.gtag('event', 'shop_click', { shop_name: shop, accessory: acc, page_path: location.pathname }); } catch (e) {}
      try { if (VG.lead && navigator.sendBeacon) navigator.sendBeacon(VG.lead, new Blob([JSON.stringify({ kind: 'shop_click', shop: shop, accessory: acc, page: location.pathname, time: new Date().toISOString() })], { type: 'text/plain' })); } catch (e) {}
    });
  });

  // Quote forms
  document.querySelectorAll('form[data-quote]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var get = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      var vehicle = f.dataset.vehicle || get('vehicle');
      var need = f.dataset.need || get('need');
      var area = get('area');
      var msg = 'Hi VehicleGuide, I need help finding a shop';
      if (need) msg += ' for ' + need.toLowerCase();
      if (vehicle) msg += ' for my ' + vehicle;
      msg += '.';
      if (area) msg += ' My area: ' + area + '.';
      msg += ' (Ref: ' + location.pathname + ')';
      track('form', [vehicle, need, area].join(' | '));
      window.open(wa(msg), '_blank', 'noopener');
    });
  });

  // Home page picker
  var picker = document.querySelector('form[data-picker]');
  var raw = document.getElementById('pick-data');
  if (picker && raw) {
    var list = JSON.parse(raw.textContent);
    var type = picker.querySelector('[data-type]');
    var veh = picker.querySelector('[data-vehicle]');
    var need = picker.querySelector('[data-need]');
    var opt = function (v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
    type.addEventListener('change', function () {
      veh.length = 1; need.length = 1; need.disabled = true;
      list.filter(function (x) { return x.t === type.value; }).forEach(function (x) { veh.appendChild(opt(x.p, x.n)); });
      veh.disabled = !type.value;
    });
    veh.addEventListener('change', function () {
      need.length = 1;
      var x = list.filter(function (y) { return y.p === veh.value; })[0];
      if (x) x.a.forEach(function (a) { need.appendChild(opt(a[0], a[1])); });
      need.disabled = !x;
    });
    picker.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var base = VG.base || '';
      if (veh.value) location.href = base + veh.value + (need.value ? need.value + '/' : '');
      else if (type.value) location.href = base + '/' + type.value + '/';
      else location.href = base + '/vehicles/';
    });
  }

  // Vehicle list filter
  var filter = document.querySelector('[data-filter]');
  if (filter) {
    var empty = document.querySelector('[data-empty]');
    filter.addEventListener('input', function () {
      var q = filter.value.trim().toLowerCase(), any = false;
      document.querySelectorAll('[data-group]').forEach(function (g) {
        var shown = 0;
        g.querySelectorAll('.rows > li').forEach(function (li) {
          var hit = li.textContent.toLowerCase().indexOf(q) !== -1;
          li.hidden = !hit; if (hit) shown++;
        });
        g.hidden = shown === 0; if (shown) any = true;
      });
      if (empty) empty.hidden = any;
    });
  }
})();
