/* PHC37 PWA — app.js (PHC37-PWA-1.0.0) */
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

  var state = { pcToken: null, profile: null, installEvt: null };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage (กันกรณีเบราว์เซอร์ปิด storage) ----------
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function sdel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function clearSession() { sdel(KEY_TOKEN); sdel(KEY_EXP); sdel(KEY_PROFILE); state.profile = null; }
  function saveToken(token, exp) { sset(KEY_TOKEN, token); sset(KEY_EXP, exp || ''); }
  function tokenValid() {
    var t = sget(KEY_TOKEN), e = sget(KEY_EXP);
    return !!t && (!e || new Date(e).getTime() > Date.now());
  }

  // ---------- API ----------
  function api(action, data) {
    if (!API_URL) return Promise.resolve({ ok: false, code: 'config', message: 'ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js' });
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
        if (res && res.code === 'unauthorized' && action !== 'auth.setNewPassword') {
          clearSession();
          showLogin(res.message);
        }
        return res || { ok: false, code: 'empty', message: 'ไม่ได้รับคำตอบจากระบบ' };
      });
  }

  // ---------- UI helpers ----------
  function show(view) {
    ['view-login', 'view-setpw', 'view-home'].forEach(function (v) { $(v).hidden = v !== view; });
    $('topbar').hidden = view !== 'view-home';
    closeAccountMenu();
  }
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
  function loading(on, text) {
    $('loading-text').textContent = text || 'กำลังโหลด...';
    $('loading').hidden = !on;
  }
  function busy(btn, on, text) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text || 'กำลังดำเนินการ...'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
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

  // ---------- หน้าเข้าสู่ระบบ ----------
  function showLogin(message) {
    state.pcToken = null;
    show('view-login');
    setAlert('login-alert', message || '', false);
    $('login-password').value = '';
    setTimeout(function () { ($('login-username').value ? $('login-password') : $('login-username')).focus(); }, 50);
  }

  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('login-username').value.trim(), p = $('login-password').value;
    if (!u || !p) return setAlert('login-alert', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    setAlert('login-alert', '');
    var btn = $('btn-login'); busy(btn, true, 'กำลังเข้าสู่ระบบ...');
    api('auth.login', { username: u, password: p }).then(function (res) {
      busy(btn, false);
      if (!res.ok) { setAlert('login-alert', res.message); $('login-password').select(); return; }
      $('login-password').value = '';
      if (res.mustChange) {
        state.pcToken = res.token;
        $('setpw-name').textContent = (res.user && res.user.fullName) || u;
        $('setpw-new').value = ''; $('setpw-confirm').value = '';
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
    var btn = $('btn-setpw'); busy(btn, true, 'กำลังบันทึก...');
    api('auth.setNewPassword', { token: state.pcToken, newPassword: n, confirmPassword: c }).then(function (res) {
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

  // ---------- หน้าหลัก ----------
  function enterHome(res) {
    saveToken(res.token, res.expiresAt);
    var profile = { user: res.user, menus: res.menus || [] };
    sset(KEY_PROFILE, JSON.stringify(profile));
    renderHome(profile);
  }

  function renderHome(profile) {
    state.profile = profile;
    var u = profile.user || {};
    var name = u.fullName || u.username || '';
    $('acc-initial').textContent = name.charAt(0) || '?';
    $('acc-name').textContent = name;
    $('acc-full').textContent = name;
    $('acc-meta').textContent = [ROLE_LABEL[u.role] || u.role, u.position].filter(Boolean).join(' · ');
    $('home-greet').textContent = 'สวัสดี ' + name;
    var groups = (u.groups || []).filter(function (g) { return g !== 'all'; }).map(function (g) { return GROUP_LABEL[g] || g; });
    $('home-sub').textContent = groups.length ? 'กลุ่มงาน: ' + groups.join(', ') : (u.role === 'superadmin' ? 'เข้าถึงได้ทุกกลุ่มงาน' : '');
    $('menu-search').value = '';
    renderMenus('');
    show('view-home');
  }

  function renderMenus(filter) {
    var wrap = $('menu-groups');
    wrap.textContent = '';
    var q = (filter || '').trim().toLowerCase();
    var menus = ((state.profile && state.profile.menus) || []).filter(function (m) {
      return !q || (m.name + ' ' + (m.description || '') + ' ' + (m.departmentName || '')).toLowerCase().indexOf(q) >= 0;
    });
    var order = [], byGroup = {};
    menus.forEach(function (m) {
      var g = m.departmentName || GROUP_LABEL[m.group] || 'ทั่วไป';
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
      byGroup[g].push(m);
    });
    order.forEach(function (g) {
      var sec = document.createElement('section'); sec.className = 'group';
      var h = document.createElement('h2'); h.className = 'group-title'; h.textContent = g;
      var tiles = document.createElement('div'); tiles.className = 'tiles';
      byGroup[g].forEach(function (m) { tiles.appendChild(tile(m)); });
      sec.appendChild(h); sec.appendChild(tiles); wrap.appendChild(sec);
    });
    $('menu-empty').hidden = menus.length > 0;
    $('menu-empty').textContent = q ? 'ไม่พบระบบงานที่ค้นหา' : 'ยังไม่มีระบบงานที่คุณมีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  }

  function menuReady(m) { return !!m.url && !m.requireGateway; }

  function tile(m) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile' + (menuReady(m) ? '' : ' pending');
    b.dataset.key = m.key;
    var icon = document.createElement('span'); icon.className = 'tile-icon'; icon.textContent = m.icon || '📌';
    var text = document.createElement('span');
    var name = document.createElement('div'); name.className = 'tile-name'; name.textContent = m.name;
    var note = document.createElement('div'); note.className = 'tile-note';
    note.textContent = menuReady(m) ? (m.description || '') : 'กำลังย้ายมาระบบใหม่';
    text.appendChild(name); if (note.textContent) text.appendChild(note);
    b.appendChild(icon); b.appendChild(text);
    b.addEventListener('click', function () { openMenu(m); });
    return b;
  }

  function openMenu(m) {
    if (!menuReady(m)) {
      toast('ระบบ "' + m.name + '" กำลังย้ายมาระบบใหม่ — ระหว่างนี้ใช้ระบบเดิมไปก่อน');
      return;
    }
    if (!/^https:\/\//i.test(m.url)) { toast('ลิงก์ของเมนูนี้ไม่ถูกต้อง กรุณาแจ้งผู้ดูแลระบบ', 'err'); return; }
    window.open(m.url, '_blank', 'noopener');
  }

  $('menu-search').addEventListener('input', function (e) { renderMenus(e.target.value); });

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
    $('btn-install-login').hidden = false; $('btn-install-menu').hidden = false;
  });
  function doInstall() {
    if (!state.installEvt) return;
    state.installEvt.prompt();
    state.installEvt.userChoice.then(function () {
      state.installEvt = null; $('btn-install-login').hidden = true; $('btn-install-menu').hidden = true;
    });
  }
  $('btn-install-login').addEventListener('click', doInstall);
  $('btn-install-menu').addEventListener('click', function () { closeAccountMenu(); doInstall(); });
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

  // ---------- เริ่มต้น ----------
  function boot() {
    if (!API_URL) { showLogin('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js'); return; }
    if (!tokenValid()) { clearSession(); showLogin(); return; }
    var cached = null;
    try { cached = JSON.parse(sget(KEY_PROFILE) || 'null'); } catch (e) { cached = null; }
    if (cached) renderHome(cached); else loading(true, 'กำลังโหลดข้อมูลผู้ใช้...');
    api('auth.me', { token: sget(KEY_TOKEN) }).then(function (res) {
      loading(false);
      if (res.ok) {
        var profile = { user: res.user, menus: res.menus || [] };
        sset(KEY_PROFILE, JSON.stringify(profile));
        var q = $('menu-search').value;
        state.profile = profile;
        if (!$('view-home').hidden && cached) renderMenus(q); else renderHome(profile);
      } else if (res.code === 'maintenance') {
        clearSession(); showLogin(res.message);
      } else if (res.code !== 'unauthorized' && !cached) {
        showLogin(res.message);
      } else if (res.code !== 'unauthorized') {
        toast(res.message, 'err');
      }
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  boot();
})();
