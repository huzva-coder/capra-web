(function () {
  'use strict';

  var CONFIG = {
    web3formsKey: '84c5d67b-7585-47fa-b480-412d0ae05eba',
    posthogKey: 'phc_qDyhdbHpUHVZ59CYQAGPAkhsnZaGSCoZyTWCCigRg4kJ',
    posthogHost: 'https://eu.i.posthog.com'
  };
  var isSet = function (v) { return v && v.charAt(0) !== '['; };

  document.documentElement.classList.add('js');

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------- analytika ---------------- */

  if (isSet(CONFIG.posthogKey)) {
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init(CONFIG.posthogKey, { api_host: CONFIG.posthogHost });
  }

  function track(name, props) {
    if (window.posthog && window.posthog.capture) window.posthog.capture(name, props || {});
  }

  /* ---------------- kalkulačka ---------------- */

  var ODVODY = 1.338;          // 24,8 % sociální + 9 % zdravotní, sazby 2026
  var DNU_V_ROCE = 250;
  var UVODNI_CIL = 6;          // po najetí na sekci sem posuvník dojede
  var UVODNI_START = 30;       // a jede z opačného konce
  var ROZJEZD_MS = 2000;

  // výchozí hodnoty; návštěvník si je může v rozbalovátku přepsat
  function param(id, zaloha, delitel) {
    var el = document.getElementById(id);
    var v = el ? parseFloat(el.value) : NaN;
    if (!isFinite(v) || v < 0) v = zaloha;
    return delitel ? v / delitel : v;
  }
  function sazby() {
    return {
      reditel: { mzda: param('mzda-reditel', 110000), podil: param('podil-reditel', 10, 100) },
      manazer: { mzda: param('mzda-manazer', 60000), podil: param('podil-manazer', 20, 100) }
    };
  }

  var slider = document.getElementById('pocet');
  var sliderWrap = slider && slider.closest('.slider');
  var calcBox = document.querySelector('[data-calc]');

  var out = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-out]'), function (el) {
    var k = el.getAttribute('data-out');
    (out[k] = out[k] || []).push(el);
  });
  function napis(klic, hodnota) {
    (out[klic] || []).forEach(function (el) { el.textContent = hodnota; });
  }

  function rocniNaklad(pocet) {
    var s = sazby();
    var manazeru = Math.max(0, pocet - 1);
    var reditel = s.reditel.mzda * ODVODY * s.reditel.podil * 12;
    var manazeri = manazeru * s.manazer.mzda * ODVODY * s.manazer.podil * 12;
    return {
      manazeru: manazeru,
      kc: Math.round(reditel + manazeri),
      dny: Math.round((s.reditel.podil + manazeru * s.manazer.podil) * DNU_V_ROCE)
    };
  }

  var formatKc = function (n) { return n.toLocaleString('cs-CZ'); };
  var pocetFrame = null;

  function sklon(n, jeden, malo, hodne) {
    if (n === 1) return jeden;
    if (n >= 2 && n <= 4) return malo;
    return hodne;
  }

  function prepocitej() {
    if (!slider) return;
    var pocet = parseInt(slider.value, 10);
    var v = rocniNaklad(pocet);
    var podil = (pocet - slider.min) / (slider.max - slider.min);
    if (sliderWrap) sliderWrap.style.setProperty('--p', podil);
    slider.style.setProperty('--p', podil);
    napis('pocet', pocet);
    napis('manazeru', v.manazeru);
    napis('dny', v.dny);
    napis('kc', formatKc(v.kc));
    napis('slovoLide', sklon(pocet, 'člověk', 'lidé', 'lidí'));
    napis('slovoManazer', sklon(v.manazeru,
      'manažer či mistr', 'manažeři či mistři', 'manažerů či mistrů'));
  }

  function rozjed(cil) {
    if (!slider) return;
    if (prefersReducedMotion()) { slider.value = cil; prepocitej(); return; }
    var od = parseInt(slider.value, 10);
    var start = performance.now();
    (function krok(t) {
      var p = Math.min(1, (t - start) / ROZJEZD_MS);
      var eased = 1 - Math.pow(1 - p, 3);
      slider.value = Math.round(od + (cil - od) * eased);
      prepocitej();
      if (p < 1) pocetFrame = requestAnimationFrame(krok);
    })(start);
  }

  if (slider) {
    prepocitej();

    var calcTimer = null;
    slider.addEventListener('input', function () {
      if (pocetFrame) { cancelAnimationFrame(pocetFrame); pocetFrame = null; }
      prepocitej();
      clearTimeout(calcTimer);
      calcTimer = setTimeout(function () {
        track('calc_change', { pocet: parseInt(slider.value, 10) });
      }, 600);
    });

    Array.prototype.forEach.call(
      document.querySelectorAll('#mzda-reditel, #podil-reditel, #mzda-manazer, #podil-manazer'),
      function (el) {
        el.addEventListener('input', function () {
          prepocitej();
          clearTimeout(calcTimer);
          calcTimer = setTimeout(function () { track('calc_param_change', { pole: el.id }); }, 800);
        });
      });

    if (calcBox && 'IntersectionObserver' in window) {
      slider.value = UVODNI_START;      // začíná nahoře a při najetí sjede dolů
      prepocitej();
      var calcObserver = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        calcObserver.disconnect();
        rozjed(UVODNI_CIL);
      }, { threshold: 0.45 });
      calcObserver.observe(calcBox);
    } else if (calcBox) {
      slider.value = UVODNI_CIL;
      prepocitej();
    }
  }

  /* ---------------- rozbalení celého rozsahu ---------------- */

  Array.prototype.forEach.call(document.querySelectorAll('[data-rozsah]'), function (box) {
    var btn = box.querySelector('.rozsah-btn');
    var text = box.querySelector('.rozsah-text');
    if (!btn || !text) return;

    btn.addEventListener('click', function () {
      var otevrit = !box.classList.contains('is-open');
      btn.setAttribute('aria-expanded', otevrit ? 'true' : 'false');
      btn.setAttribute('aria-label', otevrit ? 'Skrýt celý rozsah' : 'Zobrazit celý rozsah');

      // strop se počítá z obsahu; pevná hodnota v CSS text na úzkém displeji ořezávala
      text.style.maxHeight = text.scrollHeight + 'px';
      if (otevrit) {
        box.classList.add('is-open');
      } else {
        requestAnimationFrame(function () {
          box.classList.remove('is-open');
          text.style.maxHeight = '';
        });
      }
    });

    // po dojetí strop pustit, ať se text nepřiskřípne při otočení displeje
    text.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'max-height' && box.classList.contains('is-open')) {
        text.style.maxHeight = 'none';
      }
    });
  });

  /* ---------------- vizitky u fotek v hero ---------------- */

  var figury = document.querySelectorAll('[data-vizitka]');

  function prepniVizitku(fig, videt) {
    var btn = fig.querySelector('.vizitka-btn');
    fig.classList.toggle('je-videt', videt);
    btn.setAttribute('aria-expanded', videt ? 'true' : 'false');
    btn.setAttribute('aria-label', videt ? 'Skrýt vizitku' : 'Zobrazit vizitku');
  }

  Array.prototype.forEach.call(figury, function (fig) {
    var btn = fig.querySelector('.vizitka-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var videt = !fig.classList.contains('je-videt');
      // ve výškovém formátu leží obě karty na stejném místě, ať se nepřekryjí
      Array.prototype.forEach.call(figury, function (jina) {
        if (jina !== fig) prepniVizitku(jina, false);
      });
      prepniVizitku(fig, videt);
      if (videt) track('vizitka_open');
    });
  });

  /* ---------------- sekce a hloubka scrollu ---------------- */

  if ('IntersectionObserver' in window) {
    var casovace = {};
    var sekceObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var jmeno = e.target.getAttribute('data-section');
        if (e.isIntersecting) {
          casovace[jmeno] = setTimeout(function () {
            track('section_view', { section: jmeno });
            if (jmeno === 'sluzby') track('demo_complete');
            sekceObserver.unobserve(e.target);
          }, 1000);
        } else {
          clearTimeout(casovace[jmeno]);
        }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(document.querySelectorAll('[data-section]'), function (s) {
      sekceObserver.observe(s);
    });

    // značky musí měřit výšku dokumentu, ne viewportu — proto body jako vztažný prvek
    if (getComputedStyle(document.body).position === 'static') document.body.style.position = 'relative';

    [25, 50, 75, 100].forEach(function (procento) {
      var znacka = document.createElement('div');
      znacka.setAttribute('aria-hidden', 'true');
      znacka.style.cssText = 'position:absolute;left:0;width:1px;height:1px;pointer-events:none;' +
        'top:calc(' + procento + '% - 1px)';
      document.body.appendChild(znacka);
      var o = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          track('scroll_depth', { percent: procento });
          o.disconnect();
        }
      });
      o.observe(znacka);
    });
  }

  /* ---------------- formulář ---------------- */

  var form = document.getElementById('lead');
  if (!form) return;

  var phone = form.querySelector('#phone');
  var status = form.querySelector('[data-status]');
  var tlacitko = form.querySelector('button[type=submit]');
  var zapocato = false;
  var partialOdeslan = false;
  var partialTimer = null;

  function normalizujTelefon(hodnota) {
    var cisty = String(hodnota).replace(/[\s()\-./]/g, '');
    var m = cisty.match(/^(?:\+?420)?([2-9]\d{8})$/);
    return m ? '+420' + m[1] : null;
  }

  function chyba(pole, zobraz) {
    var el = form.querySelector('[data-err="' + pole + '"]');
    if (el) el.hidden = !zobraz;
  }

  function sbirej(partial) {
    var data = new FormData(form);
    return {
      partial: partial,
      typ: partial ? 'ČÁSTEČNÝ LEAD — formulář nedokončen' : 'KOMPLETNÍ LEAD',
      phone: normalizujTelefon(data.get('phone')) || data.get('phone'),
      email: data.get('email') || '',
      company: data.get('company') || '',
      zprava: data.get('zprava') || '',
      termin: [data.get('date') || '', data.get('cas') || ''].join(' ').trim(),
      url: location.href,
      access_key: CONFIG.web3formsKey,
      subject: partial ? 'Částečný lead (jen telefon)' : 'Nový lead z webu'
    };
  }

  function odesli(payload, useBeacon) {
    if (!isSet(CONFIG.web3formsKey)) return Promise.reject(new Error('chybí Web3Forms klíč'));
    var telo = JSON.stringify(payload);
    var url = 'https://api.web3forms.com/submit';
    if (useBeacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(url, new Blob([telo], { type: 'application/json' }))) {
        return Promise.resolve();
      }
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: telo,
      keepalive: true
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
  }

  form.addEventListener('input', function () {
    if (!zapocato) { zapocato = true; track('form_start'); }
  });

  phone.addEventListener('input', function () {
    var norm = normalizujTelefon(phone.value);
    if (norm) chyba('phone', false);
    if (!norm || partialOdeslan) return;

    clearTimeout(partialTimer);
    partialTimer = setTimeout(function () {
      if (partialOdeslan) return;
      partialOdeslan = true;
      track('phone_valid');
      odesli(sbirej(true), true).then(function () {
        track('lead_partial');
      }, function (e) {
        console.warn('Částečný lead neodešel:', e.message);
      });
    }, 800);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var norm = normalizujTelefon(phone.value);
    chyba('phone', !norm);
    phone.setAttribute('aria-invalid', norm ? 'false' : 'true');

    if (!norm) { phone.focus(); return; }

    tlacitko.disabled = true;
    status.textContent = 'Odesílám…';
    status.removeAttribute('data-tone');

    odesli(sbirej(false), false).then(function () {
      track('lead_submit', { has_email: !!form.querySelector('#email').value });
      status.textContent = 'Máme to. Ozvu se vám na ' + norm + '.';
      status.setAttribute('data-tone', 'ok');
      Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (p) {
        p.disabled = true;
      });
    }, function (err) {
      tlacitko.disabled = false;
      status.setAttribute('data-tone', 'err');
      status.textContent = isSet(CONFIG.web3formsKey)
        ? 'Odeslání se nepovedlo. Zavolejte prosím přímo na číslo výše.'
        : 'Formulář zatím nikam neodesílá — chybí Web3Forms klíč v script.js.';
      console.warn('Lead neodešel:', err.message);
    });
  });
})();
