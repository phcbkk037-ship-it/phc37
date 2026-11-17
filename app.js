/* PHC37 PWA — app.js (PHC37-PWA-1.4.0) */
var PHC37_APP_VERSION = '1.4.0';
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
    ['view-login', 'view-setpw', 'view-home', 'view-admin', 'view-register', 'view-forgot'].forEach(function (v) { $(v).hidden = v !== view; });
    $('topbar').hidden = view !== 'view-home' && view !== 'view-admin';
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
    api('public.status', {}).then(function (res) {
      var box = $('login-maint');
      if (res.ok && res.maintenance && res.maintenance.on) { box.textContent = '🔧 ' + res.maintenance.text; box.hidden = false; }
      else box.hidden = true;
    });
  }
  function fmtTime(iso) {
    try {
      var d = new Date(iso), o = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' };
      if (d.getFullYear() !== new Date().getFullYear()) o.year = '2-digit';
      return d.toLocaleString('th-TH', o) + ' น.';
    }
    catch (e) { return ''; }
  }

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
    $('acc-initial').textContent = name.charAt(0) || '?';
    $('acc-name').textContent = name;
    $('acc-full').textContent = name;
    $('acc-meta').textContent = [ROLE_LABEL[u.role] || u.role, u.position].filter(Boolean).join(' · ');
    $('home-greet').textContent = 'สวัสดี ' + name;
    var groups = (u.groups || []).filter(function (g) { return g !== 'all'; }).map(function (g) { return GROUP_LABEL[g] || g; });
    $('home-sub').textContent = groups.length ? 'กลุ่มงาน: ' + groups.join(', ') : (u.role === 'superadmin' ? 'เข้าถึงได้ทุกกลุ่มงาน' : '');
    $('menu-search').value = '';
    renderMaintBanner(profile);
    renderMenus();
    show('view-home');
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
    var grid = document.createElement('div'); grid.className = 'tiles';
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
      var crumb = document.createElement('div'); crumb.className = 'crumb';
      crumb.textContent = 'เมนูหลัก › ' + (parent ? parent.name : '');
      wrap.appendChild(crumb);
      grid.appendChild(backTile());
      list = childrenOf(state.groupKey, menus);
      list.forEach(function (m) { grid.appendChild(tile(m, menus)); });
    } else {
      list = menus.filter(function (m) { return !m.parentKey || !keys[m.parentKey]; });
      list.forEach(function (m) { grid.appendChild(tile(m, menus)); });
      if (canManage()) grid.appendChild(manageTile());
    }

    wrap.appendChild(grid);
    var count = grid.querySelectorAll('.tile:not(.back)').length;
    $('menu-empty').hidden = count > 0;
    $('menu-empty').textContent = q ? 'ไม่พบระบบที่ตรงกับคำค้นหา'
      : (state.groupKey ? 'ยังไม่มีระบบในกลุ่มนี้' : 'ยังไม่มีระบบงานที่คุณมีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }

  function makeTile(icon, title, note, noteClass, onClick, extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile' + (extraClass ? ' ' + extraClass : '');
    var i = document.createElement('span'); i.className = 'tile-icon'; i.textContent = icon;
    var text = document.createElement('span'); text.className = 'tile-text';
    var n = document.createElement('div'); n.className = 'tile-name'; n.textContent = title;
    text.appendChild(n);
    if (note) {
      var d = document.createElement('div'); d.className = 'tile-note' + (noteClass ? ' ' + noteClass : ''); d.textContent = note;
      text.appendChild(d);
    }
    b.appendChild(i); b.appendChild(text);
    b.addEventListener('click', onClick);
    return b;
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
    } else if (isRealUrl(m.url)) {
      var ready = !m.requireGateway;
      el = makeTile(iconOf(m, '📌'), m.name, ready ? (m.description || '') : 'กำลังย้ายมาระบบใหม่',
        ready ? '' : 'pending', function () { openMenu(m); });
    } else if (isLogsMenu(m)) {
      el = makeTile(iconOf(m, '🧾'), m.name, '', '', function () {
        if (window.PHC37Admin) window.PHC37Admin.open('logs'); else toast('โหลดหน้าไม่สำเร็จ กรุณารีเฟรช', 'err');
      });
    } else {
      el = makeTile(iconOf(m, '📌'), m.name, 'เร็วๆ นี้', 'soon', function () {
        toast('หน้า "' + m.name + '" กำลังสร้างในระบบใหม่ ระหว่างนี้ใช้ Gateway เดิมไปก่อน');
      });
    }
    el.dataset.key = m.key;
    return el;
  }

  function manageTile() {
    var el = makeTile('⚙️', 'จัดการระบบกลาง', 'ผู้ใช้ · คำขอ · ออกรหัส', 'count', function () {
      if (window.PHC37Admin) window.PHC37Admin.open(); else toast('โหลดหน้าจัดการไม่สำเร็จ กรุณารีเฟรช', 'err');
    });
    el.dataset.key = '__manage';
    return el;
  }

  function backTile() {
    var el = makeTile('↩️', 'กลับเมนูหลัก', '', '', function () { closeGroup(); }, 'back');
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

  // ---------- เลขเวอร์ชัน (ไว้เช็กว่าเปิดไฟล์ล่าสุดอยู่) ----------
  if ($('app-version')) $('app-version').textContent = 'PHC37 PWA เวอร์ชัน ' + PHC37_APP_VERSION;

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
        var profile = { user: res.user, menus: res.menus || [], maintenance: res.maintenance || null };
        sset(KEY_PROFILE, JSON.stringify(profile));
        if (!$('view-home').hidden && cached) {
          state.profile = profile;
          renderMaintBanner(profile);
          if (state.groupKey && !profile.menus.some(function (m) { return m.key === state.groupKey; })) state.groupKey = null;
          renderMenus();
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

  // ให้ admin.js ใช้ร่วม
  window.PHC37 = {
    api: api, toast: toast, busy: busy, setAlert: setAlert, loading: loading, show: show, emailOk: emailOk,
    token: function () { return sget(KEY_TOKEN); },
    showLogin: showLogin, bindRules: bindRules, rulesOk: rulesOk,
    comboFill: comboFill, comboValue: comboValue, comboSet: comboSet, isMainAffiliation: isMainAffiliation,
    profile: function () { return state.profile; },
    goHome: function () { state.groupKey = null; renderMenus(); show('view-home'); window.scrollTo(0, 0); },
    refreshProfile: function () {
      return api('auth.me', { token: sget(KEY_TOKEN) }).then(function (res) {
        if (!res.ok) return res;
        var profile = { user: res.user, menus: res.menus || [], maintenance: res.maintenance || null };
        sset(KEY_PROFILE, JSON.stringify(profile));
        state.profile = profile; renderMaintBanner(profile); renderMenus();
        return res;
      });
    },
    fmtTime: fmtTime,
    groupLabel: function (g) { return GROUP_LABEL[g] || g; },
    roleLabel: function (r) { return ROLE_LABEL[r] || r; }
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  boot();
})();
