// ---------- SITE UI (no network dependencies — works even if Supabase is unreachable) ----------
(function(){
  'use strict';
  var root = document.documentElement;
  var $ = function(id){ return document.getElementById(id); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var store = {
    get: function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set: function(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  };
  function esc(str){ var d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function scrollBehavior(){ return reduceMotion.matches ? 'auto' : 'smooth'; }
  function onMediaChange(mq, fn){ if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }

  var srStatus = $('sr-status');
  function announce(msg){ srStatus.textContent = ''; setTimeout(function(){ srStatus.textContent = msg; }, 50); }

  // ---------- DARK MODE ----------
  var themeBtn = $('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyTheme(mode){
    var dark = mode === 'dark';
    root.classList.toggle('dark', dark);
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    if (themeMeta) themeMeta.content = dark ? '#0F2942' : '#FFFFFF';
  }
  applyTheme(root.classList.contains('dark') ? 'dark' : 'light');
  themeBtn.addEventListener('click', function(){
    var next = root.classList.contains('dark') ? 'light' : 'dark';
    store.set('site-theme', next);
    applyTheme(next);
  });
  // Follow the OS setting until the visitor picks a theme themselves
  onMediaChange(window.matchMedia('(prefers-color-scheme: dark)'), function(e){
    if (!store.get('site-theme')) applyTheme(e.matches ? 'dark' : 'light');
  });

  // ---------- MOBILE MENU ----------
  var menuBtn = $('menu-toggle');
  var menu = $('nav-menu');
  function setMenu(open){
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function(){ setMenu(!menu.classList.contains('open')); });
  menu.addEventListener('click', function(e){ if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', function(e){
    if (menu.classList.contains('open') && !e.target.closest('.site-header')) setMenu(false);
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && menu.classList.contains('open')){ setMenu(false); menuBtn.focus(); }
  });
  onMediaChange(window.matchMedia('(max-width: 820px)'), function(e){ if (!e.matches) setMenu(false); });

  // ---------- STICKY HEADER SHADOW, SCROLL PROGRESS, BACK TO TOP, FLOATING CONTACT ----------
  var header = document.querySelector('.site-header');
  var progress = $('scroll-progress');
  var toTop = $('back-to-top');
  var contactFab = $('contact-fab');
  var contactTargetsInView = {};
  var ticking = false;
  function updateScrollUI(){
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, y / max)) : 0) + ')';
    header.classList.toggle('scrolled', y > 8);
    toTop.classList.toggle('is-visible', y > 600);
    var nearContact = Object.keys(contactTargetsInView).some(function(k){ return contactTargetsInView[k]; });
    contactFab.classList.toggle('is-visible', y > 600 && !nearContact);
  }
  function requestScrollUI(){ if (!ticking){ ticking = true; requestAnimationFrame(updateScrollUI); } }
  window.addEventListener('scroll', requestScrollUI, { passive:true });
  window.addEventListener('resize', requestScrollUI);
  if ('IntersectionObserver' in window){
    var fabIO = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ contactTargetsInView[en.target.id] = en.isIntersecting; });
      requestScrollUI();
    });
    ['booking', 'contact'].forEach(function(id){ var el = $(id); if (el) fabIO.observe(el); });
  }
  updateScrollUI();

  toTop.addEventListener('click', function(){
    window.scrollTo({ top:0, behavior:scrollBehavior() });
    $('nav-brand-wrap').focus({ preventScroll:true });
  });

  // ---------- REVEAL-ON-SCROLL (loading animation) ----------
  var revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting){ en.target.classList.add('in'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin:'0px 0px -6% 0px' }) : null;
  function observeReveal(scope){
    scope = scope || document;
    var els = Array.prototype.slice.call(scope.querySelectorAll('.reveal:not(.in)'));
    if (scope.matches && scope.matches('.reveal:not(.in)')) els.push(scope);
    els.forEach(function(el){ if (revealIO) revealIO.observe(el); else el.classList.add('in'); });
  }
  observeReveal();

  // ---------- COPY TO CLIPBOARD ----------
  function copyText(text){
    if (navigator.clipboard && window.isSecureContext){
      return navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text){
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch(e){ return false; }
  }
  function enhanceCodeBlocks(scope){
    (scope || document).querySelectorAll('pre:not([data-copy-ready])').forEach(function(pre){
      pre.setAttribute('data-copy-ready', '');
      var wrap = document.createElement('div');
      wrap.className = 'code-block';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.addEventListener('click', function(){
        copyText(pre.textContent.replace(/\n$/, '')).then(function(ok){
          btn.textContent = ok ? 'Copied!' : 'Failed';
          btn.classList.toggle('copied', ok);
          announce(ok ? 'Code copied to clipboard' : 'Couldn’t copy — select the text and copy manually');
          clearTimeout(btn._reset);
          btn._reset = setTimeout(function(){ btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
        });
      });
      wrap.appendChild(btn);
    });
  }
  // Any button with data-copy="..." copies that value (used for the email address)
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    copyText(btn.getAttribute('data-copy')).then(function(ok){
      var original = btn.getAttribute('data-tip-default') || btn.getAttribute('data-tip');
      btn.setAttribute('data-tip-default', original);
      btn.setAttribute('data-tip', ok ? 'Copied!' : 'Couldn’t copy');
      btn.classList.toggle('copied', ok);
      announce(ok ? 'Copied to clipboard' : 'Couldn’t copy');
      clearTimeout(btn._reset);
      btn._reset = setTimeout(function(){ btn.classList.remove('copied'); btn.setAttribute('data-tip', original); }, 1800);
    });
  });

  // ---------- UTM TRACKING ON OUTBOUND LINKS ----------
  // Messaging deep links (WhatsApp) are left untouched — extra params there are meaningless.
  var UTM_SKIP_HOST = /(^|\.)(wa\.me|whatsapp\.com)$/i;
  function tagOutbound(a){
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#') return;
    if (a.getAttribute('data-utm-tagged') === a.href) return; // already tagged, unchanged since
    var url;
    try { url = new URL(raw, location.href); } catch(e){ return; }
    if (!/^https?:$/.test(url.protocol) || url.host === location.host) return;
    a.setAttribute('data-href-clean', url.href);
    if (!UTM_SKIP_HOST.test(url.hostname) && !url.searchParams.has('utm_source')){
      var scope = a.closest('section[id], header, footer, [id="chat-panel"]');
      var content = a.getAttribute('data-utm-content') || (scope ? (scope.id || scope.tagName.toLowerCase()) : 'page');
      url.searchParams.set('utm_source', location.hostname || 'portfolio');
      url.searchParams.set('utm_medium', 'referral');
      url.searchParams.set('utm_campaign', 'portfolio');
      url.searchParams.set('utm_content', content);
      a.href = url.toString();
    }
    if (a.target === '_blank' && !/\bnoopener\b/.test(a.rel)) a.rel = (a.rel + ' noopener').trim();
    a.setAttribute('data-utm-tagged', a.href);
  }
  function decorateLinks(scope){ (scope || document).querySelectorAll('a[href]').forEach(tagOutbound); }
  // Safety net for links added later: tag right before any click / middle-click / context menu
  ['click', 'auxclick', 'contextmenu'].forEach(function(type){
    document.addEventListener(type, function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if (a) tagOutbound(a);
    }, true);
  });

  // ---------- COOKIE BANNER ----------
  var banner = $('cookie-banner');
  function syncBannerOffset(){ root.style.setProperty('--banner-h', banner.hidden ? '0px' : (banner.offsetHeight + 16) + 'px'); }
  if (!store.get('cookie-consent')){
    banner.hidden = false;
    syncBannerOffset();
    window.addEventListener('resize', syncBannerOffset);
  }
  banner.querySelectorAll('[data-consent]').forEach(function(btn){
    btn.addEventListener('click', function(){
      store.set('cookie-consent', btn.getAttribute('data-consent'));
      banner.hidden = true;
      syncBannerOffset();
      window.removeEventListener('resize', syncBannerOffset);
      announce('Cookie preference saved');
    });
  });

  // ---------- PRINT: expand every FAQ, then restore ----------
  var closedForPrint = null; // null = not currently printing (guards against repeated beforeprint events)
  window.addEventListener('beforeprint', function(){
    if (closedForPrint) return;
    closedForPrint = Array.prototype.filter.call(document.querySelectorAll('details'), function(d){ return !d.open; });
    closedForPrint.forEach(function(d){ d.open = true; });
  });
  window.addEventListener('afterprint', function(){
    if (!closedForPrint) return;
    closedForPrint.forEach(function(d){ d.open = false; });
    closedForPrint = null;
  });

  // ---------- FULL SITE SEARCH ----------
  var dlg = $('search-dialog');
  var input = $('search-input');
  var list = $('search-results');
  var emptyEl = $('search-empty');
  var labelEl = $('search-label');
  var STATIC_ENTRIES = [
    { kind:'Section', title:'What I build', body:'Services, systems and automations I build', target:'solutions', suggest:true },
    { kind:'Section', title:'Recent projects', body:'Portfolio of client and personal builds', target:'projects', suggest:true },
    { kind:'Section', title:'About', body:'Bio, background and stats', target:'about', suggest:true },
    { kind:'Section', title:'Book a call', body:'Schedule a meeting, calendar, availability, appointment', target:'booking', suggest:true },
    { kind:'Section', title:'Contact', body:'Email, WhatsApp, LinkedIn, get in touch', target:'contact', suggest:true },
    { kind:'Section', title:'Newsletter', body:'Subscribe to email updates', target:'newsletter', suggest:true }
  ];
  var index = [];
  var results = [];
  var active = -1;
  function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function setSearchIndex(dynamicEntries){
    index = STATIC_ENTRIES.concat(dynamicEntries || []).map(function(e){
      return Object.assign({}, e, { _t:norm(e.title), _b:norm(e.body) });
    });
    if (dlg.open) runSearch();
  }
  setSearchIndex([]);

  function tokensOf(q){ return q.trim().split(/\s+/).filter(Boolean); }
  function highlight(text, q){
    var toks = tokensOf(q).map(function(t){ return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!toks.length) return esc(text);
    var re = new RegExp('(' + toks.join('|') + ')', 'gi');
    return String(text).split(re).map(function(part, i){ return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); }).join('');
  }
  function snippet(body, q){
    body = String(body || '');
    var lower = body.toLowerCase();
    var pos = -1;
    tokensOf(q).some(function(t){ pos = lower.indexOf(t.toLowerCase()); return pos >= 0; });
    if (pos < 0) return body.length > 140 ? body.slice(0, 140) + '…' : body;
    var start = Math.max(0, pos - 50), end = Math.min(body.length, pos + 110);
    return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
  }
  function runSearch(){
    var q = input.value;
    var toks = tokensOf(norm(q));
    var isDefault = !toks.length;
    if (isDefault){
      results = index.filter(function(e){ return e.suggest; });
    } else {
      results = index.map(function(e){
        var score = 0;
        for (var i = 0; i < toks.length; i++){
          var t = toks[i], inT = e._t.indexOf(t) >= 0, inB = e._b.indexOf(t) >= 0;
          if (!inT && !inB) return null;
          score += inT ? (e._t.indexOf(t) === 0 ? 6 : 4) : 1;
        }
        return { e:e, score:score };
      }).filter(Boolean).sort(function(a, b){ return b.score - a.score; }).slice(0, 12).map(function(r){ return r.e; });
    }
    labelEl.textContent = isDefault ? 'Jump to' : results.length + (results.length === 1 ? ' result' : ' results');
    list.innerHTML = results.map(function(e, i){
      return '<li role="option" class="search-result" id="sr-opt-' + i + '" data-i="' + i + '" aria-selected="false">' +
        '<span class="sr-kind">' + esc(e.kind) + '</span>' +
        '<span class="sr-title">' + highlight(e.title, q) + '</span>' +
        (!isDefault && e.body ? '<span class="sr-snippet">' + highlight(snippet(e.body, q), q) + '</span>' : '') +
      '</li>';
    }).join('');
    emptyEl.hidden = isDefault || results.length > 0;
    if (!emptyEl.hidden) emptyEl.textContent = 'No results for “' + q.trim() + '”. Try a tool name like “n8n”, or “booking”.';
    setActive(results.length ? 0 : -1);
  }
  function setActive(i){
    active = i;
    Array.prototype.forEach.call(list.children, function(li, j){ li.setAttribute('aria-selected', String(j === i)); });
    if (i >= 0){
      input.setAttribute('aria-activedescendant', 'sr-opt-' + i);
      list.children[i].scrollIntoView({ block:'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }
  function go(entry){
    closeSearch();
    var el = document.getElementById(entry.target);
    if (!el || el.closest('[hidden]')) return;
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ behavior:scrollBehavior(), block:entry.block || 'start' });
    var focusEl = el.tagName === 'DETAILS' ? el.querySelector('summary') : el;
    if (focusEl === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    focusEl.focus({ preventScroll:true });
    el.classList.remove('search-hit'); void el.offsetWidth; el.classList.add('search-hit');
  }
  function openSearch(){
    if (dlg.open) return;
    setMenu(false);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    input.value = '';
    runSearch();
    input.focus();
  }
  function closeSearch(){
    if (!dlg.open) return;
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }
  input.addEventListener('input', runSearch);
  input.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); if (results.length) setActive((active + 1) % results.length); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); if (results.length) setActive((active - 1 + results.length) % results.length); }
    else if (e.key === 'Enter'){ e.preventDefault(); if (active >= 0) go(results[active]); }
    // type="search" inputs swallow the first Esc to clear their text — make Esc always close
    else if (e.key === 'Escape'){ e.preventDefault(); closeSearch(); }
  });
  list.addEventListener('click', function(e){ var li = e.target.closest('.search-result'); if (li) go(results[+li.getAttribute('data-i')]); });
  list.addEventListener('mousemove', function(e){ var li = e.target.closest('.search-result'); if (li && +li.getAttribute('data-i') !== active) setActive(+li.getAttribute('data-i')); });
  $('search-open').addEventListener('click', openSearch);
  $('search-close').addEventListener('click', closeSearch);
  dlg.addEventListener('click', function(e){ if (e.target === dlg) closeSearch(); }); // backdrop
  document.addEventListener('keydown', function(e){
    var t = e.target, tag = (t.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)){ e.preventDefault(); if (dlg.open) closeSearch(); else openSearch(); }
    else if (e.key === '/' && !typing && !dlg.open){ e.preventDefault(); openSearch(); }
  });

  window.SiteUI = {
    observeReveal: observeReveal,
    enhanceCodeBlocks: enhanceCodeBlocks,
    decorateLinks: decorateLinks,
    setSearchIndex: setSearchIndex,
    refresh: requestScrollUI,
    announce: announce,
    openSearch: openSearch
  };
  decorateLinks();
  if (location.hash === '#search') openSearch();
})();
