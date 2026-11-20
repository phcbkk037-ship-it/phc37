/* PHC37 PWA — app.js (PHC37-PWA-2.5.0 · 2.5.0 ระบบประเมินสุขภาพ อสส. + ระบบควบคุมโรคติดต่อในแอป · 2.4.0 ระบบดูแลและติดตามผู้มีภาวะพึ่งพิง (LTC) ในแอป · 2.3.0 ระบบคัดกรองและติดตามกลุ่มเสี่ยงโรคเรื้อรังในชุมชนในแอป · 2.2.0 ทะเบียนครุภัณฑ์คอมพิวเตอร์และแจ้งซ่อมในแอป · 2.0.0 ทะเบียนบุคลากรกลางในแอป · 2.1.0 ระบบเบิก–จ่ายวัสดุในแอป · 2.1.1 หน้าเว็บลูกซ่อนเมนู Gateway) */
var PHC37_APP_VERSION = '2.5.0';
(function () {
  'use strict';

  var CFG = window.PHC37_CONFIG || {};
  var API_URL = CFG.API_URL || '';
  var KEY_TOKEN = 'phc37.token', KEY_EXP = 'phc37.expires', KEY_PROFILE = 'phc37.profile';
  var GROUP_LABEL = {
    all: 'ทั่วไป', opd: 'งาน OPD', homecare: 'งานเยี่ยมบ้าน', dental: 'งานทันตกรรม', social_work: 'งานสังคมสงเคราะห์',
    physical_therapy: 'งานกายภาพ', mental_health: 'งานสุขภาพจิต', pharmacy: 'งานเภสัชกรรม', admin_office: 'งานธุรการ',
    school_health: 'งานอนามัยโรงเรียน', medical_records: 'เวชระเบียน', hr: 'งานบุคคล', environment: 'สิ่งแวดล้อม',
    bhz7: 'Bangkok Health Zone 7', it: 'งานสารสนเทศ'
  };
  var ROLE_LABEL = { superadmin: 'ผู้ดูแลระบบสูงสุด', admin: 'ผู้ดูแลระบบ', manager: 'หัวหน้างาน', staff: 'เจ้าหน้าที่' };

  var state = { pcToken: null, pcNeedsEmail: false, profile: null, installEvt: null, groupKey: null };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage (กันกรณีเบราว์เซอร์ปิด storage) ----------
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function sdel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // ---------- แคชข้อมูลในเครื่อง (แสดงทันที แล้วค่อยอัปเดตจากเซิร์ฟเวอร์) — แยกตามผู้ใช้ · ล้างเมื่อออกจากระบบ ----------
  var KEY_CACHE = 'phc37.c.';
  function cacheKey(k) { var u = state.profile && state.profile.user && state.profile.user.username; return u ? KEY_CACHE + u + '.' + k : null; }
  function cacheGet(k) {
    var key = cacheKey(k); if (!key) return null;
    try { var x = JSON.parse(sget(key) || 'null'); return x ? x.v : null; } catch (e) { return null; }
  }
  function cacheSet(k, v) {
    var key = cacheKey(k); if (!key) return;
    var s = JSON.stringify({ t: Date.now(), v: v });
    if (s.length < 400000) sset(key, s);
  }
  function cacheClear() {
    try {
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(KEY_CACHE) === 0) ks.push(k); }
      ks.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }
  /**
   * stale-while-revalidate: มีข้อมูลเดิม → แสดงทันที (render(res, true)) แล้วเรียกเซิร์ฟเวอร์
   * ได้ข้อมูลใหม่และต่างจากเดิม → แสดงใหม่ · เชื่อมต่อไม่ได้ → คงข้อมูลเดิมไว้และแจ้งเตือน
   * fresh = true → ไม่ใช้ข้อมูลเดิม (ใช้หลังบันทึก/แก้ไข)
   */
  function swr(key, fetcher, render, onWait, fresh) {
    var c = fresh ? null : cacheGet(key);
    if (c) render(c, true); else if (onWait) onWait();
    return fetcher().then(function (res) {
      if (res && res.ok) {
        cacheSet(key, res);
        if (!c || JSON.stringify(c) !== JSON.stringify(res)) render(res, false);
      } else if (!c || (res && res.code !== 'network')) render(res, false);
      else toast('เชื่อมต่อไม่สำเร็จ — แสดงข้อมูลล่าสุดที่บันทึกไว้', 'err');
      return res;
    });
  }

  function clearSession() {
    cacheClear();
    sdel(KEY_TOKEN); sdel(KEY_EXP); sdel(KEY_PROFILE); state.profile = null;
    if (window.PHC37Tasks) window.PHC37Tasks.reset();
  }
  function saveToken(token, exp) { sset(KEY_TOKEN, token); sset(KEY_EXP, exp || ''); }
  function tokenValid() {
    var t = sget(KEY_TOKEN), e = sget(KEY_EXP);
    return !!t && (!e || new Date(e).getTime() > Date.now());
  }

  // ---------- API ----------
  // ---------- Loading แบบ B: เส้นวิ่งด้านบน (รอเกิน 0.3 วิ แสดง · แสดงอย่างน้อย 0.3 วิ · ล้มเหลวเป็นสีแดง) ----------
  var LN = { n: 0, t: null, at: 0 };
  function lineStart() {
    if (++LN.n > 1) return;
    clearTimeout(LN.t);
    LN.t = setTimeout(function () { var tl = $('topline'); if (tl) { tl.className = 'topline on'; LN.at = Date.now(); } }, 300);
  }
  function lineEnd(fail) {
    if (LN.n === 0) return;
    if (--LN.n > 0) return;
    clearTimeout(LN.t);
    var tl = $('topline'); if (!tl || tl.className.indexOf('on') < 0) return;
    setTimeout(function () {
      if (LN.n > 0) return;
      tl.className = 'topline done' + (fail ? ' fail' : '');
      LN.t = setTimeout(function () { if (LN.n === 0) tl.className = 'topline'; }, fail ? 900 : 450);
    }, Math.max(0, 300 - (Date.now() - LN.at)));
  }

  // ---------- หน้าเปิดระบบ ----------
  var bootSlowT = null;
  function bootOn() { var b = $('boot'); return !!(b && !b.hidden); }
  function bootStep(text) { if (bootOn()) $('boot-text').textContent = text; }
  function bootHide() {
    clearTimeout(bootSlowT);
    var b = $('boot'); if (!b || b.hidden || b.classList.contains('out')) return;
    b.classList.add('out');
    setTimeout(function () { b.hidden = true; b.classList.remove('out', 'fail'); }, 260);
  }
  function bootFail(msg) {
    clearTimeout(bootSlowT);
    var b = $('boot'); b.hidden = false; b.classList.remove('out'); b.classList.add('fail');
    $('boot-text').textContent = 'เชื่อมต่อระบบไม่สำเร็จ';
    $('boot-fail-text').textContent = (!msg || /^เชื่อมต่อระบบไม่สำเร็จ/.test(msg))
      ? 'กรุณาตรวจสอบอินเทอร์เน็ต แล้วกด "ลองใหม่"' : msg;
    $('boot-fail').hidden = false;
  }
  $('boot-retry').addEventListener('click', function () {
    var b = $('boot'); b.classList.remove('fail'); $('boot-fail').hidden = true;
    $('boot-text').textContent = 'กำลังเปิดระบบ…';
    boot();
  });

  /** opts.quiet = งานเบื้องหลัง ไม่แสดงเส้นวิ่ง */
  function api(action, data, opts) {
    if (!API_URL) return Promise.resolve({ ok: false, code: 'config', message: 'ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js' });
    var quiet = (opts && opts.quiet) || bootOn();
    if (!quiet) lineStart();
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data || {} }),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); })
      .catch(function () {
        return { ok: false, code: 'network', message: navigator.onLine ? 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต' };
      })
      .then(function (res) {
        clearTimeout(timer);
        res = apiExplain(res);
        if (!quiet) lineEnd(!res || res.code === 'network');
        if (res && res.code === 'unauthorized' && action !== 'auth.setNewPassword') {
          clearSession();
          showLogin(res.message);
        }
        return res || { ok: false, code: 'empty', message: 'ไม่ได้รับคำตอบจากระบบ' };
      });
  }

  /** คำตอบที่ไม่ใช่รูปแบบของระบบเรา (เช่น Supabase ตอบ "Requested function was not found") = ตั้ง API_URL ผิด */
  function apiExplain(res) {
    if (!res || typeof res !== 'object') return res;
    if (typeof res.ok !== 'boolean') {
      return { ok: false, code: 'config', message: 'API_URL ในไฟล์ config.js ไม่ถูกต้อง (' + String(res.message || res.msg || res.error || 'ระบบตอบกลับผิดรูปแบบ') + ') — ใช้ค่าเดียวกับ EDGE_API_URL ใน Script Properties' };
    }
    if (res.code === 'unknown_action') {
      res.message = (res.message || 'ไม่รู้จักคำสั่ง') + ' — ตรวจว่า API_URL ในไฟล์ config.js ชี้ไปที่ Edge Function รุ่นล่าสุด';
    }
    return res;
  }

  // ---------- UI helpers ----------
  var CHILD_VIEWS = ['view-personnel', 'view-material', 'view-itasset', 'view-cnr', 'view-ltc', 'view-oss', 'view-cdc'];   // หน้าเว็บลูก: ไม่แสดงเมนู Gateway
  var IN_APP = ['view-home', 'view-admin', 'view-tasks', 'view-patients', 'view-personnel', 'view-material', 'view-itasset', 'view-cnr', 'view-ltc', 'view-oss', 'view-cdc'];
  function show(view) {
    bootHide();
    ['view-login', 'view-setpw', 'view-home', 'view-admin', 'view-tasks', 'view-patients', 'view-personnel', 'view-material', 'view-itasset', 'view-cnr', 'view-ltc', 'view-oss', 'view-cdc', 'view-register', 'view-forgot'].forEach(function (v) { $(v).hidden = v !== view; });
    var inApp = IN_APP.indexOf(view) >= 0;
    $('shell').hidden = !inApp; $('app').hidden = inApp;
    // เว็บลูกมีเมนูของตัวเอง + ปุ่มกลับเมนูหลัก → ซ่อนเมนู Gateway (ผู้ใช้กำหนด 18 พ.ย.)
    $('shell').classList.toggle('gw7-child', CHILD_VIEWS.indexOf(view) >= 0);
    closeAccountMenu(); closeSide();
    if (view === 'view-home') setPage('home', 'หน้าหลัก');
  }
  /** หัวหน้า + แถบเมนูซ้าย: ชื่อหน้า และเมนูที่กำลังเปิด (แบบ Gateway เดิม) */
  function setPage(navKey, title) {
    if (title) { $('gw7-title').textContent = title; document.title = title + ' · PHC37'; }
    Array.prototype.forEach.call(document.querySelectorAll('#gw7-side .gw7-nav[data-go]'), function (b) {
      b.classList.toggle('gw7-active', b.dataset.go === navKey);
      if (b.dataset.go === navKey) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function openSide() { $('shell').classList.add('gw7-side-open'); }
  function closeSide() { $('shell').classList.remove('gw7-side-open'); }
  function setAlert(id, msg, info) {
    var el = $(id);
    el.textContent = msg || '';
    el.className = 'alert' + (info ? ' info' : '');
    el.hidden = !msg;
  }
  var toastTimer;
  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg; el.className = 'toast' + (kind ? ' ' + kind : ''); el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }
  var loadingT = null;
  function loading(on, text) {
    $('loading-text').textContent = text || 'กำลังโหลด...';
    clearTimeout(loadingT);
    if (!on) { $('loading').hidden = true; return; }
    if (bootOn()) return;                                  // หน้าเปิดระบบแสดงอยู่แล้ว ไม่ซ้อน
    loadingT = setTimeout(function () { $('loading').hidden = false; }, 300);   // งานเร็วไม่กระพริบ
  }
  /** ปุ่มที่กด: วงหมุน + ข้อความ · กดซ้ำไม่ได้ */
  function busy(btn, on, text) {
    if (!btn) return;
    if (on) {
      if (btn.getAttribute('aria-busy') === 'true') return;
      btn.dataset.label = btn.textContent;
      btn.textContent = '';
      var s = document.createElement('span'); s.className = 'btn-spin'; s.setAttribute('aria-hidden', 'true');
      btn.appendChild(s); btn.appendChild(document.createTextNode(text || 'กำลังดำเนินการ...'));
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    } else {
      if (btn.getAttribute('aria-busy') === 'true') btn.textContent = btn.dataset.label || '';
      btn.disabled = false; btn.removeAttribute('aria-busy');
    }
  }
  /** โครงเทาแทนข้อความ "กำลังโหลด" — kind: 'rows' (ค่าเริ่มต้น) | 'line' */
  function skeleton(target, n, kind) {
    if (target.tagName === 'TBODY') {   // ตาราง: โครงเทาในแถวเดียวเต็มความกว้าง
      target.textContent = '';
      var tr0 = document.createElement('tr'), td0 = document.createElement('td');
      td0.colSpan = target.parentNode.querySelectorAll('thead th').length || 1;
      tr0.appendChild(td0); target.appendChild(tr0);
      return skeleton(td0, n, kind);
    }
    target.textContent = '';
    var w = document.createElement(kind === 'line' ? 'span' : 'div');
    w.className = kind === 'line' ? 'sk sk-inline' : 'sk';
    w.setAttribute('aria-busy', 'true');
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = 'กำลังโหลด'; w.appendChild(sr);
    if (kind === 'line') { var l = document.createElement('span'); l.className = 'sk-l'; w.appendChild(l); }
    else {
      for (var i = 0; i < (n || 4); i++) {
        var r = document.createElement('div'); r.className = 'sk-row';
        var ic = document.createElement('div'); ic.className = 'sk-ic'; r.appendChild(ic);
        var ls = document.createElement('div'); ls.className = 'sk-lines';
        var a = document.createElement('div'); a.className = 'sk-l'; a.style.width = (55 + (i * 17) % 35) + '%';
        var b = document.createElement('div'); b.className = 'sk-l sm'; b.style.width = (30 + (i * 23) % 30) + '%';
        ls.appendChild(a); ls.appendChild(b); r.appendChild(ls); w.appendChild(r);
      }
    }
    target.appendChild(w);
    return w;
  }
  function pwRules(value) {
    return { len: value.length >= 8, alpha: /[A-Za-z]/.test(value), digit: /[0-9]/.test(value) };
  }
  function bindRules(inputId) {
    var input = $(inputId), list = document.querySelector('.rules[data-for="' + inputId + '"]');
    input.addEventListener('input', function () {
      var r = pwRules(input.value);
      Array.prototype.forEach.call(list.children, function (li) { li.classList.toggle('ok', !!r[li.dataset.rule]); });
    });
  }
  function rulesOk(value) { var r = pwRules(value); return r.len && r.alpha && r.digit; }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); }

  // ---------- หน้าเข้าสู่ระบบ ----------
  function showLogin(message) {
    state.pcToken = null;
    show('view-login');
    setAlert('login-alert', message || '', false);
    $('login-password').value = '';
    setTimeout(function () { ($('login-username').value ? $('login-password') : $('login-username')).focus(); }, 50);
    checkStatus();
  }

  // ---------- แจ้งปิดปรับปรุงที่หน้าเข้าสู่ระบบ ----------
  var lastStatusAt = 0;
  function checkStatus() {
    if (!API_URL || Date.now() - lastStatusAt < 60000) return;
    lastStatusAt = Date.now();
    api('public.status', {}, { quiet: true }).then(function (res) {
      var box = $('login-maint');
      if (res.ok && res.maintenance && res.maintenance.on) { box.textContent = '🔧 ' + res.maintenance.text; box.hidden = false; }
      else box.hidden = true;
    });
  }
  // ---------- วันเวลาแบบไทย: 17 พ.ย. 2569 14:30 น. (พ.ศ. · 24 ชม. · เวลาไทย) ----------
  var TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  function pad2(n) { return ('0' + n).slice(-2); }
  function thParts(y, m, d, hh, mm) {
    return d + ' ' + TH_MONTH[m] + ' ' + (y + 543) + (hh === undefined ? '' : ' ' + pad2(hh) + ':' + pad2(mm) + ' น.');
  }
  /** ISO (เวลาใดก็ได้) → "17 พ.ย. 2569 14:30 น." ตามเวลาประเทศไทย; dateOnly = ไม่แสดงเวลา */
  function fmtTime(iso, dateOnly) {
    if (!iso) return '';
    var t = new Date(iso).getTime(); if (isNaN(t)) return '';
    var b = new Date(t + 7 * 3600000);               // ประเทศไทย UTC+7 ไม่มีเวลาออมแสง
    return dateOnly ? thParts(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
      : thParts(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), b.getUTCHours(), b.getUTCMinutes());
  }

  // ---------- ปฏิทินไทย (แทนตัวเลือกวันที่ของเบราว์เซอร์) ----------
  // <input class="th-date" data-time="1" data-future="1"> ค่าเก็บใน dataset.v รูปแบบ YYYY-MM-DD หรือ YYYY-MM-DDTHH:mm (เวลาเครื่อง)
  function parseV(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3], hh: m[4] === undefined ? undefined : +m[4], mm: m[5] === undefined ? undefined : +m[5] } : null;
  }
  function dateGet(inp) { return inp.dataset.v || ''; }
  function dateSet(inp, v) {
    var p = parseV(v);
    inp.dataset.v = p ? v : '';
    inp.value = p ? thParts(p.y, p.m, p.d, inp.dataset.time ? p.hh || 0 : undefined, p.mm || 0) : '';
    var clr = inp.parentNode.querySelector('.th-date-clear'); if (clr) clr.hidden = !p;
  }
  var DP = { box: null, inp: null, y: 0, m: 0, sel: null };
  function dpClose() {
    if (DP.box) { DP.box.remove(); DP.box = null; }
    document.removeEventListener('mousedown', dpOutside, true);
    window.removeEventListener('resize', dpClose);
    DP.inp = null;
  }
  function dpOutside(e) { if (DP.box && !DP.box.contains(e.target) && e.target !== DP.inp) dpClose(); }
  function dpOpen(inp) {
    if (DP.inp === inp) return dpClose();
    dpClose();
    var now = new Date(), p = parseV(dateGet(inp));
    DP.inp = inp;
    DP.sel = p ? { y: p.y, m: p.m, d: p.d } : null;
    DP.y = p ? p.y : now.getFullYear(); DP.m = p ? p.m : now.getMonth();
    DP.hh = p && p.hh !== undefined ? p.hh : 8; DP.mm = p && p.mm !== undefined ? p.mm : 0;
    var box = document.createElement('div'); box.className = 'dp'; box.setAttribute('role', 'dialog');
    DP.box = box;
    (inp.closest('dialog') || document.body).appendChild(box);
    dpRender();
    var r = inp.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    var top = r.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    box.style.left = left + 'px'; box.style.top = top + 'px';
    setTimeout(function () { document.addEventListener('mousedown', dpOutside, true); window.addEventListener('resize', dpClose); }, 0);
  }
  function dpEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function dpRender() {
    var box = DP.box, inp = DP.inp, withTime = !!inp.dataset.time, future = !!inp.dataset.future;
    box.textContent = '';
    var today = new Date(), t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    // หัว: ‹ เดือน ปี ›
    var head = dpEl('div', 'dp-head');
    var prev = dpEl('button', 'dp-nav', '‹'); prev.type = 'button'; prev.title = 'เดือนก่อน';
    var next = dpEl('button', 'dp-nav', '›'); next.type = 'button'; next.title = 'เดือนถัดไป';
    var ms = dpEl('select', 'dp-month'); TH_MONTH_FULL.forEach(function (n, i) { var o = dpEl('option', null, n); o.value = i; ms.appendChild(o); }); ms.value = DP.m;
    var ys = dpEl('select', 'dp-year');
    for (var y = today.getFullYear() - 5; y <= today.getFullYear() + 5; y++) { var o = dpEl('option', null, 'พ.ศ. ' + (y + 543)); o.value = y; ys.appendChild(o); }
    if (!ys.querySelector('option[value="' + DP.y + '"]')) { var oy = dpEl('option', null, 'พ.ศ. ' + (DP.y + 543)); oy.value = DP.y; ys.appendChild(oy); }
    ys.value = DP.y;
    prev.addEventListener('click', function () { if (--DP.m < 0) { DP.m = 11; DP.y--; } dpRender(); });
    next.addEventListener('click', function () { if (++DP.m > 11) { DP.m = 0; DP.y++; } dpRender(); });
    ms.addEventListener('change', function () { DP.m = +ms.value; dpRender(); });
    ys.addEventListener('change', function () { DP.y = +ys.value; dpRender(); });
    head.appendChild(prev); head.appendChild(ms); head.appendChild(ys); head.appendChild(next);
    box.appendChild(head);
    // ตารางวัน
    var grid = dpEl('div', 'dp-grid');
    ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].forEach(function (d) { grid.appendChild(dpEl('span', 'dp-wd', d)); });
    var first = new Date(DP.y, DP.m, 1).getDay(), days = new Date(DP.y, DP.m + 1, 0).getDate();
    for (var i = 0; i < first; i++) grid.appendChild(dpEl('span'));
    for (var d = 1; d <= days; d++) {
      (function (d) {
        var b = dpEl('button', 'dp-day', String(d)); b.type = 'button';
        var t = new Date(DP.y, DP.m, d).getTime();
        if (t === t0) b.classList.add('today');
        if (DP.sel && DP.sel.y === DP.y && DP.sel.m === DP.m && DP.sel.d === d) b.classList.add('sel');
        if (future && t < t0) b.disabled = true;
        b.addEventListener('click', function () {
          DP.sel = { y: DP.y, m: DP.m, d: d };
          if (!withTime) { dpApply(); return; }
          dpRender();
        });
        grid.appendChild(b);
      })(d);
    }
    box.appendChild(grid);
    // เวลา 24 ชม.
    if (withTime) {
      var tr = dpEl('div', 'dp-time');
      tr.appendChild(dpEl('span', null, 'เวลา'));
      var hs = dpEl('select'); for (var h = 0; h < 24; h++) { var oh = dpEl('option', null, pad2(h)); oh.value = h; hs.appendChild(oh); } hs.value = DP.hh;
      var mn = dpEl('select'); var mins = []; for (var m = 0; m < 60; m += 5) mins.push(m);
      if (mins.indexOf(DP.mm) < 0) { mins.push(DP.mm); mins.sort(function (a, b) { return a - b; }); }
      mins.forEach(function (m) { var om = dpEl('option', null, pad2(m)); om.value = m; mn.appendChild(om); }); mn.value = DP.mm;
      hs.addEventListener('change', function () { DP.hh = +hs.value; });
      mn.addEventListener('change', function () { DP.mm = +mn.value; });
      tr.appendChild(hs); tr.appendChild(dpEl('b', null, ':')); tr.appendChild(mn); tr.appendChild(dpEl('span', null, 'น.'));
      box.appendChild(tr);
    }
    // ปุ่ม
    var acts = dpEl('div', 'dp-acts');
    var bToday = dpEl('button', 'btn btn-ghost btn-sm', 'วันนี้'); bToday.type = 'button';
    bToday.addEventListener('click', function () {
      DP.y = today.getFullYear(); DP.m = today.getMonth(); DP.sel = { y: DP.y, m: DP.m, d: today.getDate() };
      if (!withTime) dpApply(); else dpRender();
    });
    acts.appendChild(bToday);
    if (!inp.required) {
      var bClr = dpEl('button', 'btn btn-ghost btn-sm', 'ล้าง'); bClr.type = 'button';
      bClr.addEventListener('click', function () { dateSet(inp, ''); inp.dispatchEvent(new Event('change', { bubbles: true })); dpClose(); });
      acts.appendChild(bClr);
    }
    if (withTime) {
      var bOk = dpEl('button', 'btn btn-primary btn-sm', 'ตกลง'); bOk.type = 'button'; bOk.disabled = !DP.sel;
      bOk.addEventListener('click', dpApply);
      acts.appendChild(bOk);
    }
    box.appendChild(acts);
  }
  function dpApply() {
    if (!DP.sel) return;
    var s = DP.sel, v = s.y + '-' + pad2(s.m + 1) + '-' + pad2(s.d);
    if (DP.inp.dataset.time) v += 'T' + pad2(DP.hh) + ':' + pad2(DP.mm);
    var inp = DP.inp;
    dateSet(inp, v); inp.dispatchEvent(new Event('change', { bubbles: true }));
    dpClose(); inp.focus();
  }
  function initDatePickers(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('input.th-date'), function (inp) {
      if (inp.dataset.dpInit) return;
      inp.dataset.dpInit = '1'; inp.readOnly = true; inp.autocomplete = 'off';
      inp.placeholder = inp.placeholder || (inp.dataset.time ? 'เลือกวันและเวลา' : 'เลือกวันที่');
      var wrap = document.createElement('span'); wrap.className = 'th-date-wrap';
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      var ic = document.createElement('span'); ic.className = 'th-date-ic'; ic.textContent = '📅'; ic.setAttribute('aria-hidden', 'true'); wrap.appendChild(ic);
      if (!inp.required) {
        var clr = document.createElement('button'); clr.type = 'button'; clr.className = 'th-date-clear'; clr.textContent = '✕'; clr.title = 'ล้าง'; clr.hidden = true;
        clr.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); dateSet(inp, ''); inp.dispatchEvent(new Event('change', { bubbles: true })); });
        wrap.appendChild(clr);
      }
      inp.addEventListener('click', function (e) { e.preventDefault(); dpOpen(inp); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); dpOpen(inp); }
        else if (e.key === 'Escape') dpClose();
        else if ((e.key === 'Backspace' || e.key === 'Delete') && !inp.required) { dateSet(inp, ''); inp.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      var dlg = inp.closest('dialog'); if (dlg) dlg.addEventListener('close', dpClose);
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && DP.box) { e.preventDefault(); dpClose(); } }, true);
  initDatePickers();

  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('login-username').value.trim(), p = $('login-password').value;
    if (!u || !p) return setAlert('login-alert', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    setAlert('login-alert', '');
    var btn = $('btn-login'); busy(btn, true, 'กำลังเข้าสู่ระบบ...');
    api('auth.login', { username: u, password: p }).then(function (res) {
      busy(btn, false);
      if (!res.ok) {
        if (res.code === 'maintenance') {             // แสดงที่กล่องแจ้งปิดปรับปรุงกล่องเดียว ไม่ซ้ำสองกล่อง
          var box = $('login-maint'); box.textContent = '🔧 ' + res.message; box.hidden = false;
        } else setAlert('login-alert', res.message);
        $('login-password').select(); return;
      }
      $('login-password').value = '';
      if (res.mustChange) {
        state.pcToken = res.token;
        $('setpw-name').textContent = (res.user && res.user.fullName) || u;
        $('setpw-new').value = ''; $('setpw-confirm').value = ''; $('setpw-email').value = '';
        state.pcNeedsEmail = !!(res.user && res.user.needsEmail);
        $('setpw-email-wrap').hidden = !state.pcNeedsEmail;
        $('setpw-new').dispatchEvent(new Event('input'));
        setAlert('setpw-alert', '');
        show('view-setpw');
        setTimeout(function () { $('setpw-new').focus(); }, 50);
        return;
      }
      enterHome(res);
    });
  });

  // ---------- ตั้งรหัสใหม่ครั้งแรก ----------
  $('form-setpw').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = $('setpw-new').value, c = $('setpw-confirm').value;
    if (!rulesOk(n)) return setAlert('setpw-alert', 'รหัสผ่านยังไม่ครบเงื่อนไขด้านล่าง');
    if (n !== c) return setAlert('setpw-alert', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
    var em = $('setpw-email').value.trim();
    if (state.pcNeedsEmail && !emailOk(em)) return setAlert('setpw-alert', em ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'กรุณากรอกอีเมล');
    var btn = $('btn-setpw'); busy(btn, true, 'กำลังบันทึก...');
    api('auth.setNewPassword', { token: state.pcToken, newPassword: n, confirmPassword: c, email: state.pcNeedsEmail ? em : undefined }).then(function (res) {
      busy(btn, false);
      if (!res.ok) {
        if (res.code === 'unauthorized') {
          showLogin('หมดเวลาตั้งรหัสผ่าน (15 นาที) กรุณาเข้าสู่ระบบด้วยรหัสชั่วคราวอีกครั้ง');
          return;
        }
        return setAlert('setpw-alert', res.message);
      }
      state.pcToken = null;
      $('setpw-new').value = ''; $('setpw-confirm').value = '';
      enterHome(res);
      toast('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว', 'ok');
    });
  });
  $('btn-setpw-cancel').addEventListener('click', function () { showLogin(); });
  $('btn-go-register').addEventListener('click', function () {
    if (window.PHC37Public) window.PHC37Public.openRegister();
  });
  $('btn-go-forgot').addEventListener('click', function () {
    if (window.PHC37Public) window.PHC37Public.openForgot($('login-username').value.trim());
  });

  // ---------- หน้าหลัก (จัดแบบเดียวกับ Dashboard ของ Gateway เดิม) ----------
  var HIDDEN_MENU_NAMES = ['คำขอสมัครใช้งาน', 'คำขอลืมรหัสผ่าน', 'จัดการผู้ใช้งาน', 'จัดการสิทธิ', 'จัดการระบบกลาง'];
  var MANAGE_SEARCH = 'จัดการระบบกลาง ผู้ใช้งาน คำขอ สมัคร ลืมรหัสผ่าน สิทธิ dashboard';

  function enterHome(res) {
    saveToken(res.token, res.expiresAt);
    var profile = { user: res.user, menus: res.menus || [], maintenance: res.maintenance || null };
    sset(KEY_PROFILE, JSON.stringify(profile));
    renderHome(profile);
  }

  function renderMaintBanner(profile) {
    var m = profile && profile.maintenance, box = $('home-maint');
    if (m && m.on) {
      box.textContent = '🔧 ระบบปิดปรับปรุงอยู่ — ผู้ใช้อื่นเข้าระบบไม่ได้' + (m.until ? ' (เปิดอัตโนมัติ ' + fmtTime(m.until) + ')' : '') +
        ' · ปิด/เปิดได้ที่ ⚙️ จัดการระบบกลาง → ตั้งค่า';
      box.hidden = false;
    } else box.hidden = true;
  }

  function renderHome(profile) {
    state.profile = profile;
    state.groupKey = null;
    var u = profile.user || {};
    var name = u.fullName || u.username || '';
    var groups = (u.groups || []).filter(function (g) { return g !== 'all'; }).map(function (g) { return GROUP_LABEL[g] || g; });
    var groupText = groups.length ? groups.join(', ') : (u.role === 'superadmin' || (u.groups || []).indexOf('all') >= 0 ? 'ทุกกลุ่มงาน' : '');
    $('acc-initial').textContent = name.charAt(0) || '?';
    $('acc-name').textContent = name;
    $('acc-role').textContent = [ROLE_LABEL[u.role] || u.role, groupText].filter(Boolean).join(' · ');
    $('acc-full').textContent = name;
    $('acc-meta').textContent = [ROLE_LABEL[u.role] || u.role, u.position].filter(Boolean).join(' · ');
    var info = $('acc-info'); info.textContent = '';
    [['สังกัด', u.affiliation], ['ตำแหน่ง', u.position], ['ชื่อผู้ใช้', u.username], ['กลุ่มงาน', groupText], ['E-mail', u.email]].forEach(function (x) {
      if (!x[1]) return;
      var dt = document.createElement('dt'); dt.textContent = x[0];
      var dd = document.createElement('dd'); dd.textContent = x[1];
      info.appendChild(dt); info.appendChild(dd);
    });
    $('menu-search').value = '';
    renderMaintBanner(profile);
    renderMenus();
    renderNav();
    show('view-home');
    if (window.PHC37Tasks) window.PHC37Tasks.refresh(true);
    if (u.needsEmail) askEmail();
  }

  // ---------- บังคับกรอกอีเมล ----------
  function askEmail() {
    var d = $('dlg-email');
    if (d.open) return;
    $('email-input').value = '';
    setAlert('email-alert', '');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    setTimeout(function () { $('email-input').focus(); }, 50);
  }
  $('dlg-email').addEventListener('cancel', function (e) { e.preventDefault(); });
  $('form-email').addEventListener('submit', function (e) {
    e.preventDefault();
    var em = $('email-input').value.trim();
    if (!emailOk(em)) return setAlert('email-alert', em ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'กรุณากรอกอีเมล');
    var btn = $('btn-email'); busy(btn, true, 'กำลังบันทึก...');
    api('auth.setEmail', { token: sget(KEY_TOKEN), email: em }).then(function (res) {
      busy(btn, false);
      if (!res.ok) { if (res.code !== 'unauthorized') setAlert('email-alert', res.message); else $('dlg-email').close(); return; }
      var profile = { user: res.user, menus: res.menus || [] };
      sset(KEY_PROFILE, JSON.stringify(profile));
      state.profile = profile;
      $('dlg-email').close();
      toast(res.message || 'บันทึกอีเมลแล้ว', 'ok');
    });
  });

  function allMenus() {
    return ((state.profile && state.profile.menus) || []).filter(function (m) {
      return HIDDEN_MENU_NAMES.indexOf(String(m.name || '').trim()) < 0;
    });
  }
  function childrenOf(key, menus) {
    return (menus || allMenus()).filter(function (m) { return m.parentKey === key; });
  }
  function isGroupMenu(m, menus) {
    var mode = String(m.openMode || '').toLowerCase();
    return mode === 'group' || (Number(m.level) === 1 && childrenOf(m.key, menus).length > 0);
  }
  function isLogsMenu(m) {
    return String(m.key || '').toLowerCase() === 'logs' || String(m.url || '').trim().toLowerCase() === '#logs';
  }
  function isPatientMenu(m) {
    var k = String(m.key || '').toLowerCase(), u = String(m.url || '').trim().toLowerCase();
    return ['medical_records', 'patient_master', 'patients'].indexOf(k) >= 0 || u === '#patient_master' || u === '#medical_records';
  }
  /** ทะเบียนบุคลากรกลาง — เปิดเป็นหน้าในแอป (2.0.0) */
  function isPersonnelMenu(m) { return String(m.key || '').toLowerCase() === 'personnel_master'; }
  /** ระบบเบิก–จ่ายวัสดุ — เปิดหน้าเดิมในแอป (2.1.0) */
  function isMaterialMenu(m) { return String(m.key || '').toLowerCase() === 'material_requisition'; }
  function isItAssetMenu(m) { return String(m.key || '').toLowerCase() === 'it_asset_repair'; }
  function isCnrMenu(m) { return String(m.key || '').toLowerCase() === 'community_ncd_risk'; }
  function isOssMenu(m) { return String(m.key || '').toLowerCase() === 'oss_evaluation'; }
  function isCdcMenu(m) { return String(m.key || '').toLowerCase() === 'disease_control'; }
  function isLtcMenu(m) { return String(m.key || '').toLowerCase() === 'ltc_hhc_palliativecare'; }
  function isRealUrl(url) { return /^https?:\/\//i.test(String(url || '').trim()); }
  function canManage() {
    var r = state.profile && state.profile.user && state.profile.user.role;
    return r === 'superadmin' || r === 'admin';
  }
  function hasEmoji(text) {
    try { return /\p{Extended_Pictographic}/u.test(text); } catch (e) { return /[^\x00-\x7F]/.test(text); }
  }
  function iconOf(m, fallback) {
    var t = String(m.icon || '').trim();
    return t && hasEmoji(t) ? t : fallback;
  }

  function renderMenus() {
    var wrap = $('menu-groups');
    wrap.textContent = '';
    var q = ($('menu-search').value || '').trim().toLowerCase();
    var menus = allMenus();
    var keys = {};
    menus.forEach(function (m) { keys[m.key] = true; });
    var grid = document.createElement('div'); grid.className = 'gw-mgrid';
    $('home-menu-title').textContent = 'เมนูระบบ';
    var list = [];

    if (q) {
      state.groupKey = null;
      list = menus.filter(function (m) {
        return (m.name + ' ' + (m.description || '') + ' ' + (m.departmentName || '') + ' ' + (GROUP_LABEL[m.group] || ''))
          .toLowerCase().indexOf(q) >= 0;
      });
      list.forEach(function (m) { grid.appendChild(tile(m, menus)); });
      if (canManage() && MANAGE_SEARCH.indexOf(q) >= 0) grid.appendChild(manageTile());
    } else if (state.groupKey) {
      var parent = menus.filter(function (m) { return m.key === state.groupKey; })[0];
      $('home-menu-title').textContent = 'เมนูระบบ › ' + (parent ? parent.name : '');
      grid.appendChild(backTile());
      list = childrenOf(state.groupKey, menus);
      list.forEach(function (m) { grid.appendChild(tile(m, menus)); });
    } else {
      list = menus.filter(function (m) { return !m.parentKey || !keys[m.parentKey]; });
      list.forEach(function (m) { grid.appendChild(tile(m, menus)); });
      if (canManage()) grid.appendChild(manageTile());
    }

    wrap.appendChild(grid);
    var count = grid.querySelectorAll('.gw-mcard:not(.back)').length;
    $('menu-empty').hidden = count > 0;
    $('menu-empty').textContent = q ? 'ไม่พบระบบที่ตรงกับคำค้นหา'
      : (state.groupKey ? 'ยังไม่มีระบบในกลุ่มนี้' : 'ยังไม่มีระบบงานที่คุณมีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }

  /** การ์ดเมนูแบบ Gateway เดิม: ไอคอน · ชื่อ · กลุ่มงาน · ป้ายสถานะ · › */
  function makeTile(icon, title, note, noteClass, onClick, extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gw-mcard' + (extraClass ? ' ' + extraClass : '') + (noteClass === 'soon' || noteClass === 'pending' ? ' off' : '');
    var i = document.createElement('span'); i.className = 'ic'; i.textContent = icon; i.setAttribute('aria-hidden', 'true');
    var n = document.createElement('span'); n.className = 'nm'; n.textContent = title;
    b.appendChild(i); b.appendChild(n);
    if (note) {
      var isStatus = noteClass === 'soon' || noteClass === 'pending';
      var d = document.createElement('span');
      d.className = isStatus ? 'st' + (/ปิดปรับปรุง/.test(note) ? ' maint' : '') : 'mt';
      d.textContent = note;
      b.appendChild(d);
    }
    if (extraClass !== 'back') { var ar = document.createElement('span'); ar.className = 'ar'; ar.textContent = '›'; ar.setAttribute('aria-hidden', 'true'); b.appendChild(ar); }
    b.addEventListener('click', onClick);
    return b;
  }
  function groupNote(m) {
    if (m.departmentName) return m.departmentName;
    return !m.group || m.group === 'all' ? 'ทุกกลุ่มงาน' : (GROUP_LABEL[m.group] || m.group);
  }

  function tile(m, menus) {
    var el;
    if (isGroupMenu(m, menus)) {
      var n = childrenOf(m.key, menus).length;
      el = makeTile(iconOf(m, '📁'), m.name, n ? n + ' ระบบ' : '', 'count', function () { openGroup(m.key); }, 'group');
    } else if (m.maintenance) {
      el = makeTile(iconOf(m, '📌'), m.name, '🔧 ปิดปรับปรุง' + (m.maintenance.until ? ' ถึง ' + fmtTime(m.maintenance.until) : ''),
        'pending', function () {
          toast('"' + m.name + '" ปิดปรับปรุงชั่วคราว' + (m.maintenance.until ? ' จะเปิดประมาณ ' + fmtTime(m.maintenance.until) : ''));
        });
    } else if (isPatientMenu(m)) {
      el = makeTile(iconOf(m, '🗂️'), m.name, groupNote(m), '', function () {
        if (window.PHC37Patients) window.PHC37Patients.open(); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isMaterialMenu(m)) {
      el = makeTile(iconOf(m, '📦'), m.name, groupNote(m), '', function () {
        if (window.PHC37Material) window.PHC37Material.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isLtcMenu(m)) {
      el = makeTile(iconOf(m, '🏠'), m.name, groupNote(m), '', function () {
        if (window.PHC37Ltc) window.PHC37Ltc.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isOssMenu(m)) {
      el = makeTile(iconOf(m, '🧑‍🤝‍🧑'), m.name, groupNote(m), '', function () {
        if (window.PHC37Oss) window.PHC37Oss.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isCdcMenu(m)) {
      el = makeTile(iconOf(m, '🦠'), m.name, groupNote(m), '', function () {
        if (window.PHC37Cdc) window.PHC37Cdc.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isCnrMenu(m)) {
      el = makeTile(iconOf(m, '🩺'), m.name, groupNote(m), '', function () {
        if (window.PHC37Cnr) window.PHC37Cnr.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isItAssetMenu(m)) {
      el = makeTile(iconOf(m, '🖥️'), m.name, groupNote(m), '', function () {
        if (window.PHC37ItAsset) window.PHC37ItAsset.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isPersonnelMenu(m)) {
      el = makeTile(iconOf(m, '👥'), m.name, groupNote(m), '', function () {
        if (window.PHC37Personnel) window.PHC37Personnel.open(m); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else if (isRealUrl(m.url)) {
      var ready = !m.requireGateway;
      el = makeTile(iconOf(m, '📌'), m.name, ready ? groupNote(m) : 'กำลังย้ายมาระบบใหม่',
        ready ? '' : 'pending', function () { openMenu(m); });
    } else if (isLogsMenu(m)) {
      el = makeTile(iconOf(m, '🧾'), m.name, groupNote(m), '', function () {
        if (window.PHC37Admin) window.PHC37Admin.open('logs'); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else {
      el = makeTile(iconOf(m, '📌'), m.name, 'ยังไม่เปิดใช้งาน', 'soon', function () {
        toast('หน้า "' + m.name + '" กำลังสร้างในระบบใหม่ ระหว่างนี้ใช้ Gateway เดิมไปก่อน');
      });
    }
    el.dataset.key = m.key;
    return el;
  }

  function manageTile() {
    var el = makeTile('⚙️', 'จัดการระบบกลาง', '', '', function () {
      if (window.PHC37Admin) window.PHC37Admin.open(); else toast('โหลดหน้าจัดการไม่สำเร็จ กรุณารีเฟรช', 'err');
    });
    el.dataset.key = '__manage';
    return el;
  }

  function backTile() {
    var el = makeTile('↩️', 'กลับเมนูหลัก', 'ระบบทั้งหมด', '', function () { closeGroup(); }, 'back');
    el.dataset.key = '__back';
    return el;
  }

  function openGroup(key) {
    state.groupKey = key;
    $('menu-search').value = '';
    try { history.pushState({ phc37Group: key }, ''); } catch (e) {}
    renderMenus();
    window.scrollTo(0, 0);
  }
  function closeGroup() {
    if (history.state && history.state.phc37Group) { history.back(); return; }
    state.groupKey = null; renderMenus();
  }
  window.addEventListener('popstate', function () {
    if (state.groupKey) { state.groupKey = null; renderMenus(); }
  });

  function openMenu(m) {
    if (m.requireGateway) {
      toast('ระบบ "' + m.name + '" กำลังย้ายมาระบบใหม่ ระหว่างนี้ใช้ระบบเดิมไปก่อน');
      return;
    }
    if (!/^https:\/\//i.test(m.url)) { toast('ลิงก์ของเมนูนี้ไม่ปลอดภัย (ต้องเป็น https) กรุณาแจ้งผู้ดูแลระบบ', 'err'); return; }
    window.open(m.url, '_blank', 'noopener');
  }

  $('menu-search').addEventListener('input', function () { renderMenus(); });

  // ---------- แถบเมนูซ้าย (แบบ Gateway เดิม) ----------
  function hasPatientMenu() { return allMenus().some(isPatientMenu); }
  function renderNav() {
    var u = (state.profile && state.profile.user) || {};
    $('nav-patients').hidden = !hasPatientMenu();
    $('nav-admin').hidden = !canManage();
    $('nav-perm').hidden = u.role !== 'superadmin';
    renderSideApps();
  }
  /** ระบบงานของฉัน: ระบบที่เปิดได้ (ไม่รวมเมนูกลุ่ม) */
  function renderSideApps() {
    var box = $('gw7-apps'); box.textContent = '';
    var menus = allMenus(), n = 0;
    menus.forEach(function (m) {
      if (isGroupMenu(m, menus) || isPatientMenu(m) || isLogsMenu(m) || (!isRealUrl(m.url) && !isPersonnelMenu(m) && !isMaterialMenu(m) && !isItAssetMenu(m) && !isCnrMenu(m) && !isLtcMenu(m) && !isOssMenu(m) && !isCdcMenu(m))) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gw7-app';
      var ic = document.createElement('span'); ic.className = 'gw7-app-ic'; ic.textContent = iconOf(m, '📌'); ic.setAttribute('aria-hidden', 'true');
      var t = document.createElement('span'); t.className = 'gw7-nav-text'; t.textContent = m.name;
      b.appendChild(ic); b.appendChild(t);
      if (m.maintenance) { var tg = document.createElement('span'); tg.className = 'gw7-app-tag'; tg.textContent = 'ปิดปรับปรุง'; b.appendChild(tg); }
      b.addEventListener('click', function () { closeSide(); tile(m, menus).click(); });
      box.appendChild(b); n++;
    });
    if (!n) { var e = document.createElement('div'); e.className = 'gw7-apps-empty'; e.textContent = 'ยังไม่มีระบบงาน'; box.appendChild(e); }
  }
  $('gw7-apps-toggle').addEventListener('click', function () {
    var box = $('gw7-apps'), open = box.hidden;
    box.hidden = !open; this.setAttribute('aria-expanded', String(open)); $('gw7-apps-chev').textContent = open ? '−' : '+';
  });
  function go(key) {
    closeSide();
    if (key === 'home') { window.PHC37.goHome(); return; }
    if (key === 'tasks' || key === 'assign') { if (window.PHC37Tasks) window.PHC37Tasks.open(key === 'assign' ? 'assigned' : 'todo', key === 'assign'); return; }
    if (key === 'patients') { if (window.PHC37Patients) window.PHC37Patients.open(); return; }
    if (window.PHC37Admin) window.PHC37Admin.open(key); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
  }
  Array.prototype.forEach.call(document.querySelectorAll('#gw7-side .gw7-nav[data-go]'), function (b) {
    b.addEventListener('click', function () { go(b.dataset.go); });
  });
  $('gw7-burger').addEventListener('click', openSide);
  $('gw7-scrim').addEventListener('click', closeSide);
  $('gw7-close').addEventListener('click', closeSide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('shell').classList.contains('gw7-side-open')) closeSide(); });
  $('nav-change').addEventListener('click', function () { closeSide(); $('btn-open-change').click(); });
  $('nav-logout').addEventListener('click', function () { closeSide(); $('btn-logout').click(); });

  // ตรา/ไอคอนโหลดไม่ได้ → ซ่อนกรอบรูปเสีย
  Array.prototype.forEach.call(document.querySelectorAll('.brand-logo, .auth-logo'), function (img) {
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
  });

  // ---------- บัญชีผู้ใช้ ----------
  function closeAccountMenu() { $('account-menu').hidden = true; $('btn-account').setAttribute('aria-expanded', 'false'); }
  $('btn-account').addEventListener('click', function (e) {
    e.stopPropagation();
    var m = $('account-menu'); m.hidden = !m.hidden;
    $('btn-account').setAttribute('aria-expanded', String(!m.hidden));
  });
  document.addEventListener('click', function (e) { if (!$('account-menu').contains(e.target)) closeAccountMenu(); });

  $('btn-logout').addEventListener('click', function () {
    var t = sget(KEY_TOKEN);
    clearSession();
    if (t) api('auth.logout', { token: t });
    showLogin('ออกจากระบบแล้ว');
    $('login-alert').className = 'alert info';
  });

  // ---------- เปลี่ยนรหัสผ่าน ----------
  var dlg = $('dlg-change');
  $('btn-open-change').addEventListener('click', function () {
    closeAccountMenu();
    ['change-current', 'change-new', 'change-confirm'].forEach(function (id) { $(id).value = ''; });
    $('change-new').dispatchEvent(new Event('input'));
    setAlert('change-alert', '');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { $('change-current').focus(); }, 50);
  });
  $('btn-change-cancel').addEventListener('click', function () { dlg.close(); });
  $('form-change').addEventListener('submit', function (e) {
    e.preventDefault();
    var cur = $('change-current').value, n = $('change-new').value, c = $('change-confirm').value;
    if (!cur) return setAlert('change-alert', 'กรุณากรอกรหัสผ่านปัจจุบัน');
    if (!rulesOk(n)) return setAlert('change-alert', 'รหัสผ่านใหม่ยังไม่ครบเงื่อนไข');
    if (n !== c) return setAlert('change-alert', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
    var btn = $('btn-change'); busy(btn, true, 'กำลังบันทึก...');
    api('auth.changePassword', { token: sget(KEY_TOKEN), currentPassword: cur, newPassword: n, confirmPassword: c })
      .then(function (res) {
        busy(btn, false);
        if (!res.ok) { if (res.code !== 'unauthorized') setAlert('change-alert', res.message); else dlg.close(); return; }
        saveToken(res.token, res.expiresAt);
        dlg.close();
        toast(res.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'ok');
      });
  });

  // ---------- แสดง/ซ่อนรหัส ----------
  Array.prototype.forEach.call(document.querySelectorAll('.pw-toggle'), function (b) {
    b.addEventListener('click', function () {
      var input = $(b.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
      b.setAttribute('aria-label', input.type === 'password' ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน');
    });
  });
  bindRules('setpw-new');
  bindRules('change-new');

  // ---------- ติดตั้งแอพ ----------
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); state.installEvt = e;
    $('btn-install-login').hidden = false; $('btn-install-menu').hidden = false; $('nav-install').hidden = false;
  });
  function doInstall() {
    if (!state.installEvt) return;
    state.installEvt.prompt();
    state.installEvt.userChoice.then(function () {
      state.installEvt = null; $('btn-install-login').hidden = true; $('btn-install-menu').hidden = true; $('nav-install').hidden = true;
    });
  }
  $('btn-install-login').addEventListener('click', doInstall);
  $('btn-install-menu').addEventListener('click', function () { closeAccountMenu(); doInstall(); });
  $('nav-install').addEventListener('click', function () { closeSide(); doInstall(); });
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $('ios-hint').hidden = !(isIos && !standalone);

  // ---------- ออนไลน์/ออฟไลน์ ----------
  function updateOnline() { $('offline').hidden = navigator.onLine; }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  // ---------- หมดเวลา session ----------
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !$('view-home').hidden && !tokenValid()) {
      clearSession(); showLogin('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }
  });

  // ---------- เลขเวอร์ชัน (ไว้เช็กว่าเปิดไฟล์ล่าสุดอยู่) ----------
  if ($('app-version')) $('app-version').textContent = 'PHC37 PWA เวอร์ชัน ' + PHC37_APP_VERSION;

  // ---------- เริ่มต้น ----------
  function boot() {
    if (!API_URL) { showLogin('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js'); return; }
    if (!tokenValid()) { clearSession(); showLogin(); return; }
    var cached = null;
    try { cached = JSON.parse(sget(KEY_PROFILE) || 'null'); } catch (e) { cached = null; }
    if (cached) renderHome(cached);
    else {
      bootStep('กำลังตรวจสอบการเข้าสู่ระบบ…');
      clearTimeout(bootSlowT);
      bootSlowT = setTimeout(function () { bootStep('เซิร์ฟเวอร์กำลังเริ่มทำงาน อาจใช้เวลาสักครู่…'); }, 4000);
    }
    api('auth.me', { token: sget(KEY_TOKEN) }).then(function (res) {
      clearTimeout(bootSlowT);
      if (!res.ok && res.code === 'network' && !cached) { bootFail(res.message); return; }
      if (res.ok && !cached) bootStep('กำลังโหลดเมนู…');
      if (res.ok) {
        var profile = { user: res.user, menus: res.menus || [], maintenance: res.maintenance || null };
        sset(KEY_PROFILE, JSON.stringify(profile));
        if (!$('view-home').hidden && cached) {
          state.profile = profile;
          renderMaintBanner(profile);
          if (state.groupKey && !profile.menus.some(function (m) { return m.key === state.groupKey; })) state.groupKey = null;
          renderMenus(); renderNav();
        } else {
          renderHome(profile);
        }
      } else if (res.code === 'maintenance') {
        clearSession(); showLogin(res.message);
      } else if (res.code !== 'unauthorized' && !cached) {
        showLogin(res.message);
      } else if (res.code !== 'unauthorized') {
        toast(res.message, 'err');
      }
    });
  }

  // ---------- dropdown + "อื่น ๆ (ระบุเอง)" ----------
  var OTHER = '__other__';
  /** groups (ถ้ามี) = [{ label, items: [...] }] → แสดงเป็นหมวด (optgroup) */
  function comboFill(selId, values, placeholder, groups) {
    var sel = $(selId), other = $(selId + '-other');
    sel.textContent = '';
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = placeholder || '— เลือก —'; sel.appendChild(o0);
    var addOpt = function (parent, v) { var o = document.createElement('option'); o.value = v; o.textContent = v; parent.appendChild(o); };
    if (groups && groups.length) {
      groups.forEach(function (g) {
        var og = document.createElement('optgroup'); og.label = g.label;
        (g.items || []).forEach(function (v) { addOpt(og, v); });
        sel.appendChild(og);
      });
    } else {
      (values || []).forEach(function (v) { addOpt(sel, v); });
    }
    var oo = document.createElement('option'); oo.value = OTHER; oo.textContent = 'อื่น ๆ (ระบุเอง)'; sel.appendChild(oo);
    if (!sel.dataset.bound) {
      sel.dataset.bound = '1';
      sel.addEventListener('change', function () {
        other.hidden = sel.value !== OTHER;
        sel.classList.toggle('placeholder', !sel.value);
        if (!other.hidden) other.focus();
      });
    }
    sel.classList.add('placeholder');
    other.hidden = true; other.value = '';
  }
  function comboValue(selId) {
    var sel = $(selId);
    return sel.value === OTHER ? $(selId + '-other').value.trim() : sel.value;
  }
  function comboSet(selId, value) {
    var sel = $(selId), other = $(selId + '-other');
    value = String(value || '').trim();
    var has = Array.prototype.some.call(sel.options, function (o) { return o.value === value && value !== OTHER; });
    sel.value = !value ? '' : (has ? value : OTHER);
    other.value = has ? '' : value;
    other.hidden = sel.value !== OTHER;
    sel.classList.toggle('placeholder', !sel.value);
  }
  /** สังกัด ศบส.37 (รวมชื่อที่สะกดผิดในข้อมูลเดิม "สาธารสุข") */
  function isMainAffiliation(text) { return /ศูนย์บริการสาธารณ?สุข\s*37/.test(String(text || '')); }

  /** ข้อความแถวเดียวในตาราง (ว่าง / ผิดพลาด) */
  function tableMsg(tbody, text) {
    tbody.textContent = '';
    var tr = document.createElement('tr'), td = document.createElement('td');
    td.className = 'empty'; td.colSpan = tbody.parentNode.querySelectorAll('thead th').length || 1; td.textContent = text;
    tr.appendChild(td); tbody.appendChild(tr);
  }

  // ให้ admin.js ใช้ร่วม
  window.PHC37 = {
    api: api, toast: toast, busy: busy, setAlert: setAlert, loading: loading, skeleton: skeleton, show: show, emailOk: emailOk,
    setPage: setPage, hasPatientMenu: hasPatientMenu, tableMsg: tableMsg, openMenu: openMenu,
    token: function () { return sget(KEY_TOKEN); },
    showLogin: showLogin, bindRules: bindRules, rulesOk: rulesOk,
    comboFill: comboFill, comboValue: comboValue, comboSet: comboSet, isMainAffiliation: isMainAffiliation,
    profile: function () { return state.profile; },
    goHome: function () {
      state.groupKey = null; renderMenus(); show('view-home'); window.scrollTo(0, 0);
      if (window.PHC37Tasks) window.PHC37Tasks.refresh(false);
    },
    refreshProfile: function () {
      return api('auth.me', { token: sget(KEY_TOKEN) }).then(function (res) {
        if (!res.ok) return res;
        var profile = { user: res.user, menus: res.menus || [], maintenance: res.maintenance || null };
        sset(KEY_PROFILE, JSON.stringify(profile));
        state.profile = profile; renderMaintBanner(profile); renderMenus(); renderNav();
        return res;
      });
    },
    cacheGet: cacheGet, cacheSet: cacheSet, swr: swr,
    fmtTime: fmtTime, dateGet: dateGet, dateSet: dateSet, initDatePickers: initDatePickers,
    groupLabel: function (g) { return GROUP_LABEL[g] || g; },
    roleLabel: function (r) { return ROLE_LABEL[r] || r; }
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  boot();
})();
