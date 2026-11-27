/* PHC37 PWA — admin.js (PHC37-PWA-ADMIN-1.8.0) : จัดการระบบกลาง + สิทธิ์เมนู + ประวัติการใช้งาน
   1.8.0 (27/11/2569) หน้าการใช้ทรัพยากร (usage.report) เฉพาะ superadmin — Egress / ฐานข้อมูล / เรียก Edge เทียบเพดานแผนฟรี
   1.7.0 (22/11/2569) ประวัติการใช้งานแบบ Gateway เดิม (ความปลอดภัย · การใช้งานระบบ · ทั้งหมด) เฉพาะ superadmin
   1.6.0 (22/11/2569) ฟอร์มผู้ใช้: ระบบกลาง · เลือกรายคน (ติ๊กเพิ่ม/ตัดสิทธิ์) + ได้ทั้งกลุ่มอัตโนมัติ (แสดงอย่างเดียว) แบบ GW7 เดิม */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var A = { boot: null, users: [], requests: [], tab: 'users', editing: null, mode: 'edit', confirmFn: null };

  function call(action, data) {
    data = data || {};
    data.token = P.token();
    return P.api(action, data);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return P.fmtTime(iso) || iso;
    } catch (e) { return iso; }
  }
  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function appUrl() { return location.href.split('#')[0].split('?')[0]; }

  // ---------- เปิดหน้า ----------
  function myRole() { var p = P.profile(); return (p && p.user && p.user.role) || ''; }
  function isAdminRole() { var r = myRole(); return r === 'superadmin' || r === 'admin'; }

  /** mode: users | requests | perm | logs (เมนูซ้ายแบบ Gateway เดิม) */
  function open(mode) {
    P.show('view-admin');
    window.scrollTo(0, 0);
    try { history.pushState({ phc37Admin: 1 }, ''); } catch (e) {}
    var admin = isAdminRole();
    if (mode === 'usage' && myRole() !== 'superadmin') { P.toast('เฉพาะ superadmin เท่านั้น', 'err'); P.goHome(); return; }
    if ((mode === 'logs' && myRole() !== 'superadmin') || (!admin && mode !== 'logs')) {   // 2.14.0: ประวัติการใช้งานเฉพาะ superadmin
      P.toast(mode === 'logs' ? 'เฉพาะ superadmin เท่านั้นที่ดูประวัติการใช้งานได้' : 'เฉพาะผู้ดูแลระบบเท่านั้น', 'err'); P.goHome(); return;
    }
    Array.prototype.forEach.call(document.querySelectorAll('#view-admin .tab'), function (t) {
      t.hidden = !admin || (t.dataset.super && myRole() !== 'superadmin');
    });
    var sec = mode === 'perm' ? (myRole() === 'superadmin' ? 'menus' : 'users') : (mode || 'users');
    switchTab(sec);
    if (!admin) return;
    if (A.boot && sec === 'logs') return;
    // แสดงรายชื่อที่จำไว้ทันที แล้วค่อยอัปเดต
    var cb = P.cacheGet('adm.boot'), cu = P.cacheGet('adm.users');
    if (cb && cu) { A.boot = cb; A.users = cu; fillOptions(); setBadge(cb.pendingRequests); renderUsers(); }
    else P.loading(true, 'กำลังโหลดข้อมูลผู้ใช้...');
    Promise.all([call('admin.bootstrap'), call('admin.listUsers')]).then(function (r) {
      P.loading(false);
      if (!r[0].ok) {
        if (r[0].code === 'network' && cb) return P.toast('เชื่อมต่อไม่สำเร็จ — แสดงข้อมูลล่าสุดที่บันทึกไว้', 'err');
        P.toast(r[0].message, 'err'); if (r[0].code === 'forbidden') P.goHome(); return;
      }
      var users = r[1].ok ? r[1].users : [];
      P.cacheSet('adm.boot', r[0]); P.cacheSet('adm.users', users);
      if (cb && cu && JSON.stringify(cb) === JSON.stringify(r[0]) && JSON.stringify(cu) === JSON.stringify(users)) return;
      A.boot = r[0]; A.users = users;
      fillOptions();
      setBadge(A.boot.pendingRequests);
      renderUsers();
    });
  }
  function close() { P.goHome(); }
  $('adm-back').addEventListener('click', function () {
    if (history.state && history.state.phc37Admin) history.back(); else close();
  });
  window.addEventListener('popstate', function () { if (!$('view-admin').hidden) close(); });

  function setBadge(n) {
    var b = $('adm-req-badge'); b.textContent = n || ''; b.hidden = !n;
    var nb = $('nav-req-badge'); nb.textContent = n || ''; nb.hidden = !n;
  }

  // ---------- แท็บ ----------
  var PERM_GROUP = { menus: 1, perms: 1, settings: 1 };
  var PAGE = {
    users: ['users', 'ผู้ใช้งาน', '⚙️ จัดการระบบกลาง'], bulk: ['users', 'ผู้ใช้งาน', '⚙️ จัดการระบบกลาง'],
    requests: ['requests', 'คำขอรออนุมัติ', '⚙️ จัดการระบบกลาง'], menus: ['perm', 'สิทธิ์และเมนู', '⚙️ จัดการระบบกลาง'],
    perms: ['perm', 'สิทธิ์และเมนู', '⚙️ จัดการระบบกลาง'], settings: ['perm', 'สิทธิ์และเมนู', '⚙️ จัดการระบบกลาง'],
    logs: ['logs', 'บันทึกการใช้งาน (Log)', '🧾 ประวัติการใช้งาน'],
    usage: ['usage', 'การใช้ทรัพยากร', '⚙️ จัดการระบบกลาง']
  };
  function switchTab(tab) {
    A.tab = tab;
    var admin = isAdminRole();
    Array.prototype.forEach.call(document.querySelectorAll('#view-admin .tab'), function (t) {
      var on = t.dataset.tab === tab || (t.dataset.group === 'perm' && PERM_GROUP[tab]);
      t.classList.toggle('on', !!on); t.classList.toggle('active', !!on);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#adm-subtabs .gw7-subtab'), function (t) {
      t.classList.toggle('gw7-on', t.dataset.sub === tab);
    });
    $('adm-tiles').hidden = !admin || tab === 'logs';
    $('adm-subtabs').hidden = !PERM_GROUP[tab];
    var pg = PAGE[tab] || PAGE.users;
    $('adm-title').textContent = pg[2];
    $('adm-sub').hidden = tab !== 'logs'; $('adm-sub').textContent = 'ช่วงวันที่ที่เลือก · ล่าสุดก่อน';
    P.setPage(pg[0], pg[1]);
    ['users', 'requests', 'perms', 'menus', 'logs', 'bulk', 'settings', 'usage'].forEach(function (t) { $('tab-' + t).hidden = t !== tab; });
    if (tab === 'usage') loadUsage();
    if (tab === 'menus') loadMenus();
    if (tab === 'settings') loadSettings();
    if (tab === 'requests') loadRequests();
    if (tab === 'bulk') loadBulk(false);
    if (tab === 'perms') loadPerms();
    if (tab === 'logs') initLogs();
  }
  Array.prototype.forEach.call(document.querySelectorAll('#view-admin .tab'), function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.tab); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('#adm-subtabs .gw7-subtab'), function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.sub); });
  });
  $('adm-refresh').addEventListener('click', function () {
    var t = A.tab;
    if (t === 'users') refreshUsers();
    else if (t === 'requests') loadRequests(true);
    else if (t === 'menus') loadMenus(true);
    else if (t === 'logs') lgLoad(true);
    else if (t === 'usage') loadUsage();
    else switchTab(t);
  });

  // ---------- ตัวเลือก ----------
  function fillOptions() {
    var b = A.boot;
    var role = $('u-role'); role.textContent = '';
    b.roles.forEach(function (r) { var o = el('option', null, P.roleLabel(r.key)); o.value = r.key; role.appendChild(o); });
    role.onchange = function () { renderCentral(); };
    P.comboFill('u-position', b.positions, '— ไม่ระบุ —', b.positionGroups);
    P.comboFill('u-affiliation', b.affiliations, '— ไม่ระบุ —');
    var gw = $('u-groups'); gw.textContent = '';
    b.workgroups.forEach(function (g) {
      var l = el('label', 'check');
      var c = el('input'); c.type = 'checkbox'; c.value = g.key; c.name = 'grp';
      l.appendChild(c); l.appendChild(el('span', null, g.label));
      gw.appendChild(l);
      c.addEventListener('change', renderCentral);
    });
    var mw = $('u-menus'); mw.textContent = '';
    var byGroup = {}, order = [];
    b.menus.forEach(function (m) { if (!byGroup[m.group]) { byGroup[m.group] = []; order.push(m.group); } byGroup[m.group].push(m); });
    order.forEach(function (g) {
      var box = el('div', 'menu-group');
      box.appendChild(el('div', 'menu-group-title', P.groupLabel(g)));
      byGroup[g].forEach(function (m) {
        var l = el('label', 'check' + (m.isParent ? ' parent' : ''));
        var c = el('input'); c.type = 'checkbox'; c.value = m.key; c.name = 'menu';
        l.appendChild(c); l.appendChild(el('span', null, m.name + (m.isParent ? ' (เมนูกลุ่ม)' : '')));
        box.appendChild(l);
      });
      mw.appendChild(box);
    });
    if (!order.length && !(b.central || []).length) mw.appendChild(el('p', 'muted', 'ไม่มีระบบงานที่มอบหมายได้'));
    var cw = el('div', 'menu-group'); cw.id = 'u-central'; mw.appendChild(cw);
  }

  // ---------- ระบบกลางในฟอร์มผู้ใช้ (GW7 เดิม) ----------
  // เลือกรายคน = ช่องติ๊ก (บันทึกเป็นสิทธิ์รายคน) แสดงเมื่อกลุ่มงานที่ติ๊กมีสิทธิ์ · ได้ทั้งกลุ่ม = สีเทา แสดงอย่างเดียว
  var CEN = { picked: [] };
  function centralEligible(m, groups) {
    return (m.eligible || []).indexOf('*') >= 0 || (m.eligible || []).some(function (g) { return groups.indexOf(g) >= 0; });
  }
  function renderCentral() {
    var box = $('u-central'); if (!box) return;
    var list = (A.boot && A.boot.central) || [];
    Array.prototype.forEach.call(box.querySelectorAll('input[name=menu]'), function (c) {   // จำค่าที่ติ๊กอยู่ก่อนวาดใหม่
      var i = CEN.picked.indexOf(c.value);
      if (c.checked && i < 0) CEN.picked.push(c.value);
      if (!c.checked && i >= 0) CEN.picked.splice(i, 1);
    });
    box.textContent = '';
    var groups = getChecks('grp'), isSuperRole = $('u-role').value === 'superadmin';
    var person = list.filter(function (m) { return m.mode === 'person' && centralEligible(m, groups); });
    var auto = list.filter(function (m) { return m.mode !== 'person' && centralEligible(m, groups); });
    if (!list.length) return;
    box.appendChild(el('div', 'menu-group-title', 'ระบบกลาง · เลือกรายคน'));
    if (isSuperRole) box.appendChild(el('p', 'muted small', 'superadmin เห็นทุกระบบอยู่แล้ว'));
    else if (!groups.length) box.appendChild(el('p', 'muted small', 'เลือกกลุ่มงานก่อน แล้วระบบกลางที่ให้สิทธิ์ได้จะแสดงที่นี่'));
    else if (!person.length) box.appendChild(el('p', 'muted small', 'ไม่มีระบบกลางแบบเลือกรายคนสำหรับกลุ่มงานที่เลือก'));
    person.forEach(function (m) {
      var l = el('label', 'check');
      var c = el('input'); c.type = 'checkbox'; c.value = m.key; c.name = 'menu'; c.checked = CEN.picked.indexOf(m.key) >= 0;
      l.appendChild(c); l.appendChild(el('span', null, (m.icon ? m.icon + ' ' : '') + m.name));
      box.appendChild(l);
    });
    if (auto.length && !isSuperRole) {
      box.appendChild(el('div', 'menu-group-title', 'ระบบกลาง · ได้ทั้งกลุ่มอัตโนมัติ'));
      auto.forEach(function (m) {
        var l = el('label', 'check muted'); l.title = 'กำหนดที่ สิทธิ์และเมนู → ระบบงาน';
        var c = el('input'); c.type = 'checkbox'; c.checked = true; c.disabled = true;
        l.appendChild(c); l.appendChild(el('span', null, (m.icon ? m.icon + ' ' : '') + m.name + ' (อัตโนมัติ)'));
        box.appendChild(l);
      });
    }
    box.appendChild(el('p', 'muted small', 'มีช่องติ๊ก = ให้สิทธิ์รายคน (เอาติ๊กออก = ตัดสิทธิ์) · สีเทา = ได้ทั้งกลุ่ม · เปลี่ยนวิธีให้สิทธิ์ได้ที่ สิทธิ์และเมนู → ระบบงาน'));
  }

  // ---------- รายชื่อผู้ใช้ ----------
  function userFlags(u) {
    var f = [];
    if (u.status !== 'active') f.push(['ปิดใช้งาน', 'danger']);
    if (u.locked) f.push(['ถูกล็อก', 'danger']);
    if (!u.hasPassword) f.push(['ยังไม่มีรหัสผ่าน', 'warn']);
    else if (u.tempExpired) f.push(['รหัสชั่วคราวหมดอายุ', 'warn']);
    else if (u.mustChange) f.push(['รอตั้งรหัสใหม่', 'info']);
    if (!u.email) f.push(['ไม่มีอีเมล', 'muted']);
    return f;
  }
  function chip(text, kind) { return el('span', 'chip ' + (kind || ''), text); }

  function renderUsers() {
    var q = $('adm-search').value.trim().toLowerCase(), f = $('adm-filter').value;
    var list = A.users.filter(function (u) {
      if (q && (u.fullName + ' ' + u.username + ' ' + u.email + ' ' + u.position).toLowerCase().indexOf(q) < 0) return false;
      if (f === 'nopw') return !u.hasPassword || u.tempExpired;
      if (f === 'noemail') return !u.email;
      if (f === 'locked') return u.locked;
      if (f === 'inactive') return u.status !== 'active';
      return true;
    });
    list.sort(function (a, b) { return String(a.fullName).localeCompare(String(b.fullName), 'th'); });
    $('adm-count').textContent = 'แสดง ' + list.length + ' จากทั้งหมด ' + A.users.length + ' ผู้ใช้';
    var wrap = $('adm-users'); wrap.textContent = '';
    if (!list.length) { P.tableMsg(wrap, 'ไม่พบข้อมูลผู้ใช้งานตามเงื่อนไขที่เลือก'); return; }
    list.forEach(function (u) {
      var tr = el('tr', 'click'); tr.dataset.id = u.id;
      tr.appendChild(el('td', 'nowrap', u.username));
      tr.appendChild(el('td', null, u.fullName));
      tr.appendChild(el('td', null, u.position || '-'));
      tr.appendChild(el('td', null, u.affiliation || '-'));
      tr.appendChild(el('td', null, u.groups.length ? u.groups.map(P.groupLabel).join(', ') : '-'));
      tr.appendChild(el('td', 'nowrap', P.roleLabel(u.role)));
      var st = el('td');
      var fl = userFlags(u);
      if (!fl.some(function (x) { return x[0] === 'ปิดใช้งาน'; })) st.appendChild(el('span', 'gw-st on', 'ใช้งาน'));
      fl.forEach(function (x) { st.appendChild(document.createTextNode(' ')); st.appendChild(el('span', 'gw-st ' + (x[1] === 'danger' ? 'danger' : (x[1] === 'warn' ? 'warn' : (x[1] === 'info' ? 'info' : 'off'))), x[0])); });
      tr.appendChild(st);
      var act = el('td'); var b = el('button', 'gw-edit', '✏️ แก้ไข'); b.type = 'button'; act.appendChild(b); tr.appendChild(act);
      tr.addEventListener('click', function () { editUser(u); });
      wrap.appendChild(tr);
    });
  }
  $('adm-search').addEventListener('input', renderUsers);
  $('adm-filter').addEventListener('change', renderUsers);
  $('adm-new').addEventListener('click', function () { editUser(null); });

  // ---------- ฟอร์มผู้ใช้ ----------
  function setChecks(name, values) {
    Array.prototype.forEach.call(document.querySelectorAll('#form-user input[name=' + name + ']'), function (c) {
      c.checked = values.indexOf(c.value) >= 0;
    });
  }
  function getChecks(name) {
    return Array.prototype.filter.call(document.querySelectorAll('#form-user input[name=' + name + ']'), function (c) {
      return c.checked;
    }).map(function (c) { return c.value; });
  }

  function editUser(u, request) {
    A.editing = u; A.request = request || null;
    A.mode = request ? 'approve' : (u ? 'edit' : 'new');
    P.setAlert('user-alert', '');
    $('user-title').textContent = A.mode === 'approve' ? '✅ อนุมัติคำขอสมัคร' : (u ? '✏️ แก้ไขผู้ใช้งาน' : '➕ เพิ่มผู้ใช้งาน');
    var src = u || {};
    if (request) src = { username: request.username, fullName: request.fullName, email: request.email,
      position: request.position, affiliation: request.affiliation, groups: request.workgroup ? [request.workgroup] : [],
      role: 'staff', status: 'active', userType: P.isMainAffiliation(request.affiliation) ? 'main' : 'external', menuKeys: [] };
    $('u-username').value = src.username || '';
    $('u-fullname').value = src.fullName || '';
    $('u-email').value = src.email || '';
    $('u-role').value = src.role || (A.boot.roles.some(function (r) { return r.key === 'staff'; }) ? 'staff' : A.boot.roles[0].key);
    if (src.role && $('u-role').value !== src.role) {   // role ที่ admin ตั้งไม่ได้ (ไม่น่าเกิด) → แสดงไว้
      var o = el('option', null, P.roleLabel(src.role)); o.value = src.role; $('u-role').appendChild(o); $('u-role').value = src.role;
    }
    P.comboSet('u-position', src.position || '');
    P.comboSet('u-affiliation', src.affiliation || '');
    $('u-type').value = src.userType === 'external' ? 'external' : 'main';
    $('u-status').value = src.status === 'inactive' ? 'inactive' : 'active';
    setChecks('grp', src.groups || []);
    var cbox = $('u-central'); if (cbox) cbox.textContent = '';
    CEN.picked = (src.menuKeys || []).slice();
    renderCentral();
    setChecks('menu', src.menuKeys || []);
    var ro = A.mode === 'approve';
    $('u-username').readOnly = ro; $('u-fullname').readOnly = ro;
    var flags = $('user-flags'); flags.textContent = '';
    if (u) {
      userFlags(u).forEach(function (x) { flags.appendChild(chip(x[0], x[1])); });
      if (u.lastLoginAt) flags.appendChild(chip('เข้าล่าสุด ' + fmtDate(u.lastLoginAt), 'muted'));
    }
    if (request && request.reason) flags.appendChild(chip('เหตุผล: ' + request.reason, 'info'));
    $('u-temp').hidden = A.mode !== 'edit';
    $('u-unlock').hidden = !(u && u.locked);
    $('u-save').textContent = A.mode === 'approve' ? 'อนุมัติและออกรหัสชั่วคราว' : 'บันทึก';
    openDlg($('dlg-user'));
  }

  $('u-cancel').addEventListener('click', function () { $('dlg-user').close(); });

  $('form-user').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = {
      id: A.editing ? A.editing.id : undefined,
      username: $('u-username').value.trim(), fullName: $('u-fullname').value.trim(), email: $('u-email').value.trim(),
      role: $('u-role').value, position: P.comboValue('u-position'), affiliation: P.comboValue('u-affiliation'),
      userType: $('u-type').value, status: $('u-status').value, groups: getChecks('grp'), menuKeys: getChecks('menu')
    };
    if (!f.username || !f.fullName) return P.setAlert('user-alert', 'กรุณากรอกชื่อผู้ใช้และชื่อ-สกุล');
    if (f.email && !P.emailOk(f.email)) return P.setAlert('user-alert', 'รูปแบบอีเมลไม่ถูกต้อง');
    if (f.role !== 'superadmin' && !f.groups.length) return P.setAlert('user-alert', 'กรุณาเลือกกลุ่มงานอย่างน้อย 1 กลุ่ม');
    var btn = $('u-save'); P.busy(btn, true, 'กำลังบันทึก...');
    var req = A.mode === 'approve'
      ? call('admin.approveRequest', { requestId: A.request.id, role: f.role, groups: f.groups, menuKeys: f.menuKeys,
          userType: f.userType, appUrl: appUrl() })
      : call('admin.saveUser', { user: f });
    req.then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('user-alert', res.message);
      $('dlg-user').close();
      upsertLocal(res.user);
      if (A.mode === 'approve') {
        P.toast(res.message || 'อนุมัติคำขอแล้ว', 'ok');
        loadRequests(true);
        if (res.temp && res.temp.ok && !res.temp.emailed) showTemp(res.temp);
      } else {
        P.toast(res.message || 'บันทึกแล้ว', 'ok');
        if (res.isNew) confirmBox('ออกรหัสชั่วคราวเลยไหม?', 'ผู้ใช้ใหม่ "' + res.user.fullName + '" ยังไม่มีรหัสผ่าน',
          false, function () { return issueTemp(res.user, false); }, 'ออกรหัส');
      }
    });
  });

  function upsertLocal(u) {
    if (!u) return;
    var i = A.users.findIndex(function (x) { return x.id === u.id; });
    if (i >= 0) A.users[i] = u; else A.users.push(u);
    P.cacheSet('adm.users', A.users);
    renderUsers();
  }
  function refreshUsers() {
    return call('admin.listUsers').then(function (r) { if (r.ok) { A.users = r.users; P.cacheSet('adm.users', A.users); renderUsers(); } });
  }

  // ---------- ออกรหัส / ปลดล็อก ----------
  $('u-temp').addEventListener('click', function () {
    var u = A.editing; if (!u) return;
    $('dlg-user').close();
    if (u.email) {
      chooseTemp(u);
    } else {
      confirmBox('ออกรหัสชั่วคราว', 'ออกรหัสชั่วคราวให้ "' + u.fullName + '" (ใช้ได้ 72 ชั่วโมง) รหัสเดิมของผู้ใช้จะใช้ไม่ได้ทันที',
        false, function () { return issueTemp(u, false); }, 'ออกรหัส');
    }
  });
  function chooseTemp(u) {
    confirmBox('ออกรหัสชั่วคราว', 'ส่งรหัสชั่วคราวไปที่อีเมล ' + u.email + ' (ใช้ได้ 24 ชั่วโมง) หรือกด "แสดงบนจอ" เพื่อแจ้งเอง (72 ชั่วโมง)',
      false, function () { return issueTemp(u, true); }, '📧 ส่งอีเมล', { label: 'แสดงบนจอ', fn: function () { return issueTemp(u, false); } });
  }
  function issueTemp(u, byEmail) {
    return call('admin.issueTempPassword', { userId: u.id, sendEmail: byEmail, appUrl: appUrl() }).then(function (res) {
      if (!res.ok) return res;
      refreshUsers();
      if (res.emailed) P.toast(res.message, 'ok'); else showTemp(res);
      return res;
    });
  }
  function showTemp(res) {
    $('temp-who').textContent = (res.fullName || '') + ' · ชื่อผู้ใช้: ' + (res.username || '');
    $('temp-code').textContent = res.tempPassword;
    $('temp-exp').textContent = 'ใช้ได้ถึง ' + fmtDate(res.expiresAt) + ' · ผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าครั้งแรก';
    openDlg($('dlg-temp'));
  }
  $('temp-copy').addEventListener('click', function () {
    var t = $('temp-code').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { P.toast('คัดลอกแล้ว', 'ok'); });
  });
  $('dlg-temp').addEventListener('close', function () { $('temp-code').textContent = ''; });

  $('u-unlock').addEventListener('click', function () {
    var u = A.editing; if (!u) return;
    var btn = $('u-unlock'); P.busy(btn, true, 'กำลังปลดล็อก...');
    call('admin.unlock', { userId: u.id }).then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('user-alert', res.message);
      u.locked = false; btn.hidden = true; renderUsers();
      P.toast(res.message, 'ok');
    });
  });

  // ---------- กล่องยืนยัน ----------
  function confirmBox(title, text, needReason, fn, okLabel, alt) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-reason-wrap').hidden = !needReason;
    $('confirm-reason').value = '';
    P.setAlert('confirm-alert', '');
    $('confirm-ok').textContent = okLabel || 'ยืนยัน';
    $('confirm-ok').className = 'btn ' + (needReason ? 'btn-danger' : 'btn-primary');
    $('confirm-alt').hidden = !alt;
    $('confirm-alt').textContent = alt ? alt.label : '';
    A.confirmFn = fn; A.confirmAlt = alt || null;
    openDlg($('dlg-confirm'));
  }
  function runConfirm(fn, btn) {
    P.busy(btn, true, 'กำลังดำเนินการ...');
    Promise.resolve(fn($('confirm-reason').value.trim())).then(function (res) {
      P.busy(btn, false);
      if (res && res.ok === false) return P.setAlert('confirm-alert', res.message);
      $('dlg-confirm').close();
    });
  }
  $('form-confirm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('confirm-reason-wrap').hidden && $('confirm-reason').value.trim().length < 3) {
      return P.setAlert('confirm-alert', 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร');
    }
    runConfirm(A.confirmFn, $('confirm-ok'));
  });
  $('confirm-cancel').addEventListener('click', function () { $('dlg-confirm').close(); });
  $('confirm-alt').addEventListener('click', function () { if (A.confirmAlt) runConfirm(A.confirmAlt.fn, $('confirm-alt')); });

  // ---------- คำขอสมัคร ----------
  function loadRequests(fresh) {
    var wrap = $('adm-requests');
    P.swr('adm.requests', function () { return call('admin.listRequests'); }, function (res) {
      wrap.textContent = '';
      if (!res.ok) { P.tableMsg(wrap, res.message); return; }
      A.requests = res.requests;
      var pending = res.requests.filter(function (r) { return r.status === 'pending'; });
      setBadge(pending.length);
      if (!res.requests.length) { P.tableMsg(wrap, 'ไม่มีคำขอสมัครใช้งาน'); return; }
      res.requests.forEach(function (r) {
        var card = el('tr');
        card.appendChild(el('td', 'nowrap', fmtDate(r.createdAt)));
        card.appendChild(el('td', null, r.fullName));
        card.appendChild(el('td', null, r.position || '-'));
        card.appendChild(el('td', 'nowrap', r.username));
        card.appendChild(el('td', null, r.email || 'ไม่มีอีเมล'));
        card.appendChild(el('td', null, r.workgroup ? P.groupLabel(r.workgroup) : '-'));
        card.appendChild(el('td', null, r.reason || '-'));
        var stc = el('td');
        if (r.status === 'pending') stc.appendChild(el('span', 'gw-st warn', 'รออนุมัติ'));
        if (r.status === 'approved') { stc.appendChild(el('span', 'gw-st on', 'อนุมัติแล้ว')); stc.appendChild(el('span', 'sub', 'โดย ' + r.processedBy)); }
        if (r.status === 'rejected') { stc.appendChild(el('span', 'gw-st danger', 'ไม่อนุมัติ')); stc.appendChild(el('span', 'sub', r.rejectReason)); }
        card.appendChild(stc);
        var acts = el('td');
        card.appendChild(acts);
        if (r.status === 'pending') {
          acts = el('span', 'acts'); card.lastChild.appendChild(acts);
          var ok = el('button', 'gbtn gbtn-green gbtn-sm', '✅ อนุมัติ'); ok.type = 'button';
          ok.addEventListener('click', function () { editUser(null, r); });
          var no = el('button', 'gbtn gbtn-gray gbtn-sm', '✖️ ไม่อนุมัติ'); no.type = 'button';
          no.addEventListener('click', function () {
            confirmBox('ไม่อนุมัติคำขอ', 'ไม่อนุมัติคำขอของ "' + r.fullName + '"', true, function (reason) {
              return call('admin.rejectRequest', { requestId: r.id, reason: reason }).then(function (res2) {
                if (res2.ok) { P.toast(res2.message, 'ok'); loadRequests(true); }
                return res2;
              });
            }, 'ยืนยันไม่อนุมัติ');
          });
          acts.appendChild(ok); acts.appendChild(no);
        }
        wrap.appendChild(card);
      });
    }, function () { P.skeleton(wrap, 3); }, fresh === true);
  }

  // ---------- ออกรหัสชุด ----------
  function loadBulk(keepResult) {
    P.skeleton($('bulk-summary'), 1, 'line');
    if (!keepResult) $('bulk-result').hidden = true;
    call('admin.bulkPreview').then(function (res) {
      if (!res.ok) { $('bulk-summary').textContent = res.message; return; }
      A.bulk = res;
      $('bulk-summary').textContent = '';
      var s = $('bulk-summary');
      s.appendChild(statBox(res.withEmail, 'คนมีอีเมล → ส่งทางอีเมล (ใช้ได้ 24 ชม.)'));
      s.appendChild(statBox(res.withoutEmail, 'คนไม่มีอีเมล → พิมพ์ใบแจก (ใช้ได้ 72 ชม.)'));
      s.appendChild(statBox(res.emailQuota, 'อีเมลที่ส่งได้อีกวันนี้'));
      $('bulk-email').disabled = !res.withEmail;
      $('bulk-email').textContent = '📧 ส่งรหัสทางอีเมล (' + res.withEmail + ' คน)';
      $('bulk-print').disabled = !res.withoutEmail;
      $('bulk-print').textContent = '🖨️ ออกรหัสและพิมพ์ใบแจก (' + res.withoutEmail + ' คน)';
    });
  }
  function statBox(n, label) {
    var b = el('div', 'stat');
    b.appendChild(el('div', 'stat-num', String(n)));
    b.appendChild(el('div', 'stat-label', label));
    return b;
  }
  $('bulk-email').addEventListener('click', function () {
    confirmBox('ส่งรหัสทางอีเมล', 'ส่งรหัสชั่วคราวให้ ' + A.bulk.withEmail + ' คน ทางอีเมล ใช้เวลาประมาณ 1 วินาทีต่อคน', false, function () {
      return call('admin.bulkIssue', { mode: 'email', appUrl: appUrl() }).then(function (res) {
        if (!res.ok) return res;
        bulkDone(res, 'ส่งอีเมลสำเร็จ ' + res.count + ' คน');
        return res;
      });
    }, 'ส่งเลย');
  });
  $('bulk-print').addEventListener('click', function () {
    confirmBox('ออกรหัสและพิมพ์ใบแจก', 'ออกรหัสชั่วคราวให้ ' + A.bulk.withoutEmail +
      ' คนที่ไม่มีอีเมล รหัสจะแสดงในใบแจกครั้งเดียวเท่านั้น — เตรียมเครื่องพิมพ์ให้พร้อม', false, function () {
      return call('admin.bulkIssue', { mode: 'print' }).then(function (res) {
        if (!res.ok) return res;
        bulkDone(res, 'ออกรหัสแล้ว ' + res.count + ' คน — กำลังเปิดหน้าพิมพ์');
        if (res.slips.length) printSlips(res);
        return res;
      });
    }, 'ออกรหัส');
  });
  function bulkDone(res, msg) {
    var failMsg = res.failed && res.failed.length
      ? ' · ไม่สำเร็จ ' + res.failed.length + ' คน: ' + res.failed.map(function (f) { return f.username; }).join(', ') : '';
    var r = $('bulk-result'); r.textContent = msg + failMsg; r.hidden = false;
    refreshUsers(); loadBulk(true);
  }

  function printSlips(res) {
    var box = $('print-slips'); box.textContent = '';
    var exp = fmtDate(res.expiresAt), url = appUrl();
    res.slips.forEach(function (s) {
      var c = el('div', 'slip');
      c.appendChild(el('div', 'slip-head', 'PHC37 ระบบงาน ศบส.37 — รหัสผ่านชั่วคราว'));
      c.appendChild(el('div', 'slip-name', s.fullName + (s.position ? ' (' + s.position + ')' : '')));
      var t = el('div', 'slip-grid');
      [['ชื่อผู้ใช้', s.username], ['รหัสผ่านชั่วคราว', s.tempPassword], ['ใช้ได้ถึง', exp], ['เข้าระบบที่', url]].forEach(function (x, i) {
        t.appendChild(el('span', 'k', x[0])); t.appendChild(el('span', i === 1 ? 'v code' : 'v', x[1]));
      });
      c.appendChild(t);
      c.appendChild(el('div', 'slip-note', 'เข้าระบบแล้วตั้งรหัสใหม่และกรอกอีเมลทันที · ห้ามให้ผู้อื่นดูใบนี้ · ทำลายใบนี้หลังใช้'));
      box.appendChild(c);
    });
    var clear = function () { box.textContent = ''; window.removeEventListener('afterprint', clear); };
    window.addEventListener('afterprint', clear);   // ล้างรหัสออกจากหน้าเมื่อพิมพ์เสร็จ
    setTimeout(function () { window.print(); }, 300);
  }

  // ---------- สิทธิ์เมนูราย Role (superadmin) ----------
  var PM = { data: null, dirty: {} };
  function loadPerms(role) {
    var body = $('perm-body'); body.textContent = '';
    var tr = el('tr'); var td = el('td'); td.colSpan = 5; tr.appendChild(td); body.appendChild(tr); P.skeleton(td, 6);
    PM.dirty = {}; updateDirty();
    call('admin.permGet', { role: role || $('perm-role').value }).then(function (res) {
      if (!res.ok) { td.textContent = res.message; return; }
      PM.data = res;
      var sel = $('perm-role');
      if (!sel.options.length) {
        res.roles.forEach(function (r) { var o = el('option', null, P.roleLabel(r.key)); o.value = r.key; sel.appendChild(o); });
      }
      sel.value = res.role;
      renderPerms();
    });
  }
  $('perm-role').addEventListener('change', function () {
    if (Object.keys(PM.dirty).length && !window.confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขหรือไม่?')) {
      $('perm-role').value = PM.data.role; return;
    }
    loadPerms($('perm-role').value);
  });
  $('perm-search').addEventListener('input', renderPerms);

  function renderPerms() {
    var body = $('perm-body'); body.textContent = '';
    if (!PM.data) return;
    var q = $('perm-search').value.trim().toLowerCase();
    var order = [], by = {};
    PM.data.menus.forEach(function (m) {
      if (q && (m.name + ' ' + m.key).toLowerCase().indexOf(q) < 0) return;
      if (!by[m.group]) { by[m.group] = []; order.push(m.group); }
      by[m.group].push(m);
    });
    order.forEach(function (g) {
      var h = el('tr', 'perm-group'); var hd = el('td', null, P.groupLabel(g) === 'all' ? 'ทั่วไป' : P.groupLabel(g)); hd.colSpan = 5;
      h.appendChild(hd); body.appendChild(h);
      by[g].forEach(function (m) {
        var tr = el('tr');
        var name = el('td', m.parentKey ? 'child' : null, (m.icon && /[^\x00-\x7F]/.test(m.icon) ? m.icon + ' ' : '') + m.name);
        name.title = m.key;
        tr.appendChild(name);
        ['view', 'add', 'edit', 'del'].forEach(function (f) {
          var c = el('td', 'c'); var cb = el('input'); cb.type = 'checkbox';
          var cur = PM.dirty[m.key] ? PM.dirty[m.key][f] : m[f];
          cb.checked = !!cur;
          cb.setAttribute('aria-label', m.name + ' ' + f);
          cb.addEventListener('change', function () { markDirty(m, f, cb.checked); });
          c.appendChild(cb); tr.appendChild(c);
        });
        body.appendChild(tr);
      });
    });
    if (!order.length) P.tableMsg(body, 'ไม่พบรายการ');
  }
  function markDirty(m, f, val) {
    var d = PM.dirty[m.key] || { key: m.key, view: m.view, add: m.add, edit: m.edit, del: m.del };
    d[f] = val;
    if (f !== 'view' && val && !d.view) { d.view = true; }   // ให้เพิ่ม/แก้/ลบ ต้องเห็นเมนูด้วย
    if (d.view === m.view && d.add === m.add && d.edit === m.edit && d.del === m.del) delete PM.dirty[m.key];
    else PM.dirty[m.key] = d;
    updateDirty(); renderPerms();
  }
  function updateDirty() {
    var n = Object.keys(PM.dirty).length;
    $('perm-save').disabled = !n;
    var a = $('perm-dirty'); a.hidden = !n; a.textContent = 'แก้ไขแล้ว ' + n + ' เมนู — กด "บันทึกสิทธิ์" เพื่อให้มีผล';
  }
  $('perm-save').addEventListener('click', function () {
    var items = Object.keys(PM.dirty).map(function (k) { return PM.dirty[k]; });
    var btn = $('perm-save'); P.busy(btn, true, 'กำลังบันทึก...');
    call('admin.permSave', { role: PM.data.role, items: items }).then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.toast(res.message, 'err');
      P.toast(res.message, 'ok');
      loadPerms(PM.data.role);
    });
  });

  // ---------- ประวัติการใช้งาน ----------
  // ---------- ประวัติการใช้งาน (2.14.0 · แบบ Gateway เดิม GW-EXT-2610 · superadmin เท่านั้น) ----------
  var LG = { tab: 'security', rows: [], data: null, busy: false, inited: false, seq: 0 };
  function dateStr(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function lgDay(n) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - (n || 0) * 86400000)); }
  /** yyyy-MM-dd[ HH:mm:ss] → dd/MM/พ.ศ.[ HH:mm] */
  function lgBE(k) { k = String(k || ''); if (k.length < 10) return k; var d = k.slice(0, 10).split('-'); return d[2] + '/' + d[1] + '/' + (Number(d[0]) + 543) + (k.length > 11 ? ' ' + k.slice(11, 16) : ''); }
  function initLogs() {
    if (myRole() !== 'superadmin') { P.toast('เฉพาะ superadmin เท่านั้นที่ดูประวัติการใช้งานได้', 'err'); P.goHome(); return; }
    if (!LG.inited) {
      LG.inited = true;
      P.dateSet($('log-from'), lgDay(6)); P.dateSet($('log-to'), lgDay(0));
      Array.prototype.forEach.call(document.querySelectorAll('#lg2-tabs button'), function (b) { b.addEventListener('click', function () { lgTab(b.dataset.t); }); });
      Array.prototype.forEach.call(document.querySelectorAll('#tab-logs .lg2-quick button'), function (b) { b.addEventListener('click', function () { lgQuick(Number(b.dataset.q)); }); });
      $('log-search').addEventListener('click', function () { lgLoad(true); });
      $('log-reset').addEventListener('click', function () { $('log-user').value = ''; $('log-q').value = ''; $('log-result').value = ''; lgQuick(6); });
      ['log-user', 'log-q'].forEach(function (id) { $(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') lgLoad(true); }); });
      $('log-csv').addEventListener('click', lgCsv);
    }
    lgTab(LG.tab || 'security');
  }
  function lgTab(t) {
    LG.tab = t;
    Array.prototype.forEach.call(document.querySelectorAll('#lg2-tabs button'), function (b) { b.classList.toggle('on', b.dataset.t === t); });
    Array.prototype.forEach.call(document.querySelectorAll('#tab-logs .lg2-hide-usage'), function (e) { e.hidden = t === 'usage'; });
    lgLoad(true);
  }
  function lgQuick(n) { P.dateSet($('log-from'), lgDay(n)); P.dateSet($('log-to'), lgDay(0)); lgLoad(true); }
  function lgFilter(offset) {
    var usage = LG.tab === 'usage';
    return { tab: LG.tab, from: P.dateGet($('log-from')) || '', to: P.dateGet($('log-to')) || '', user: $('log-user').value.trim(),
      q: usage ? '' : $('log-q').value.trim(), result: usage ? '' : $('log-result').value, offset: offset || 0, limit: 50 };
  }
  function lgLoad(reset) {
    if (LG.busy && !reset) return;
    var seq = ++LG.seq, tab = LG.tab;
    LG.busy = true;
    var f = lgFilter(reset ? 0 : LG.rows.length);
    if (reset) { LG.rows = []; $('lg2-alerts').textContent = ''; P.skeleton($('lg2-body'), 6, 'line'); }
    else { var mb = $('lg2-morebtn'); if (mb) P.busy(mb, true, 'กำลังโหลด...'); }
    call('logs.view', f).then(function (res) {
      if (seq !== LG.seq || tab !== LG.tab) return;
      LG.busy = false;
      if (!res.ok) { var b = $('lg2-body'); b.textContent = ''; b.appendChild(el('div', 'empty', res.message || 'โหลดข้อมูลไม่สำเร็จ')); return; }
      LG.data = res; LG.rows = LG.rows.concat(res.rows || []);
      P.dateSet($('log-from'), res.from); P.dateSet($('log-to'), res.to);
      $('adm-sub').textContent = lgBE(res.from) + ' – ' + lgBE(res.to) + ' · ล่าสุดก่อน';
      lgRender();
    });
  }
  function chipEl(text, cls) { return el('span', 'lg2-chip' + (cls ? ' ' + cls : ''), text); }
  function lgWho(r) {
    var d = el('div', 'u');
    if (!r.user) { d.appendChild(el('b', null, '-')); return d; }
    d.appendChild(el('b', null, r.fullName || r.user));
    d.appendChild(el('small', null, r.fullName ? r.user : (r.known ? '' : 'ไม่พบบัญชีนี้ในระบบ')));
    return d;
  }
  function lgRow(r) {
    var row = el('div', 'lg2-row' + (r.result === 'fail' ? ' fail' : ''));
    var at = lgBE(r.at), t = el('div', 't');
    t.appendChild(el('b', null, at.slice(11) + ' น.')); t.appendChild(document.createTextNode(at.slice(0, 10)));
    row.appendChild(t); row.appendChild(lgWho(r));
    var w = el('div', 'w');
    w.appendChild(el('span', 'lg2-badge ' + (r.cat === 'security' ? 'request' : (r.cat === 'usage' ? 'login' : 'system')), r.label));
    if (r.system) w.appendChild(el('span', 'sys', r.system));
    var about = [r.system ? '' : r.targetName, r.detail].filter(function (x) { return x && x !== '-' && x !== r.user && x !== r.fullName; }).join(' · ');
    if (about) w.appendChild(el('div', 'd', about));
    row.appendChild(w);
    var rr = el('div', 'r'); rr.appendChild(el('span', 'lg2-badge ' + (r.result === 'fail' ? 'fail' : 'success'), r.result === 'fail' ? 'ไม่สำเร็จ' : 'สำเร็จ'));
    row.appendChild(rr);
    return row;
  }
  function lgRender() {
    var d = LG.data, al = $('lg2-alerts'), body = $('lg2-body');
    al.textContent = ''; body.textContent = '';
    if (LG.tab === 'security' && d.alerts) {
      var a = d.alerts, cards = el('div', 'lg2-cards');
      [['ใส่รหัสผิดถี่ผิดปกติ', a.burst.length + ' บัญชี', a.burst.length ? 'bad' : ''], ['เข้าสู่ระบบไม่สำเร็จ', a.failTotal + ' ครั้ง', a.failTotal ? 'warn' : ''],
       ['ถูกระงับชั่วคราว', a.throttled + ' ครั้ง', a.throttled ? 'warn' : ''], ['คำขอสมัคร / ลืมรหัส', String(a.requests), ''], ['เปลี่ยนผู้ใช้ / สิทธิ์', String(a.accountChanges), '']]
        .forEach(function (c) { var x = el('div', 'lg2-card' + (c[2] ? ' ' + c[2] : '')); x.appendChild(el('span', null, c[0])); x.appendChild(el('b', null, c[1])); cards.appendChild(x); });
      al.appendChild(cards);
      a.burst.forEach(function (x) {
        var line = el('div', 'lg2-alert'); line.appendChild(document.createTextNode('⚠️ ')); line.appendChild(el('b', null, x.fullName || x.user));
        line.appendChild(document.createTextNode((x.fullName ? ' (' + x.user + ')' : (x.known ? '' : ' — ไม่พบบัญชีนี้ อาจมีคนเดาชื่อผู้ใช้')) +
          ' ใส่รหัสผิด ' + x.count + ' ครั้งภายใน 15 นาที (ทั้งช่วง ' + x.total + ' ครั้ง) ล่าสุด ' + lgBE(x.lastAt) + ' น.'));
        al.appendChild(line);
      });
    }
    if (LG.tab === 'usage') {
      var u = d.usage || [];
      body.appendChild(el('h4', 'lg2-h', 'สรุปการใช้งานรายคน (' + u.length + ' คน)'));
      if (u.length) {
        var wrap = el('div', 'lg2-uwrap'), tb = el('table', 'lg2-utable'), th = el('thead'), hr = el('tr');
        ['ผู้ใช้', 'วันที่ใช้', 'เข้าสู่ระบบ', 'ระบบที่เปิด', 'เวชระเบียนกลาง', 'ล่าสุด'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
        th.appendChild(hr); tb.appendChild(th);
        var tbody = el('tbody');
        u.forEach(function (x) {
          var tr = el('tr'), who = el('td', 'who');
          who.appendChild(el('b', null, x.fullName || x.user));
          if (x.fullName) who.appendChild(el('small', 'sub', x.user + (x.role ? ' · ' + P.roleLabel(x.role) : '')));
          tr.appendChild(who);
          tr.appendChild(el('td', 'n', x.days + ' วัน')); tr.appendChild(el('td', 'n', 'เข้า ' + x.logins + ' ครั้ง'));
          var sy = el('td', 'wide'); if (x.systems.length) x.systems.forEach(function (s) { sy.appendChild(chipEl(s.name + ' ×' + s.count)); }); else sy.appendChild(el('span', 'muted', '-'));
          var rd = el('td', 'wide'); if (x.reads.length) x.reads.forEach(function (s) { rd.appendChild(chipEl(s.name + ' ×' + s.count, 'r')); }); else rd.appendChild(el('span', 'muted', '-'));
          tr.appendChild(sy); tr.appendChild(rd); tr.appendChild(el('td', 'wide', lgBE(x.last)));
          tbody.appendChild(tr);
        });
        tb.appendChild(tbody); wrap.appendChild(tb); body.appendChild(wrap);
      } else body.appendChild(el('div', 'empty', 'ไม่มีการใช้งานในช่วงนี้'));
      body.appendChild(el('h4', 'lg2-h', 'รายการ (' + d.total + ')'));
    } else {
      body.appendChild(el('div', 'lg2-sub', 'พบ ' + d.total + ' รายการ' + (LG.rows.length < d.total ? ' · แสดง ' + LG.rows.length : '')));
    }
    if (LG.rows.length) { var list = el('div', 'lg2-list'); LG.rows.forEach(function (r) { list.appendChild(lgRow(r)); }); body.appendChild(list); }
    else body.appendChild(el('div', 'empty', 'ไม่พบรายการในช่วงนี้'));
    if (LG.rows.length < d.total) {
      var more = el('div', 'lg2-more'), b = el('button', 'gbtn', 'โหลดเพิ่ม (เหลือ ' + (d.total - LG.rows.length) + ')');
      b.type = 'button'; b.id = 'lg2-morebtn'; b.addEventListener('click', function () { lgLoad(false); });
      more.appendChild(b); body.appendChild(more);
    }
  }
  function lgCsv() {
    if (!LG.rows.length) return P.toast('ยังไม่มีข้อมูลให้ดาวน์โหลด');
    var esc = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['เวลา', 'ผู้ใช้', 'ชื่อ-สกุล', 'Role', 'เหตุการณ์', 'รหัสเหตุการณ์', 'ระบบ', 'เป้าหมาย', 'รายละเอียด', 'ผล'].join(',')];
    LG.rows.forEach(function (l) {
      lines.push([lgBE(l.at), l.user, l.fullName, l.role, l.label, l.action, l.system, l.targetName || l.targetID, l.detail, l.result === 'fail' ? 'ไม่สำเร็จ' : 'สำเร็จ'].map(esc).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'phc37-logs-' + LG.tab + '-' + dateStr(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- วันเวลา (datetime-local ↔ ISO) ----------
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fromLocalInput(v) { if (!v) return ''; var d = new Date(v); return isNaN(d.getTime()) ? '' : d.toISOString(); }

  // ---------- ตั้งค่าระบบ (superadmin) ----------
  var ST = null;
  function loadSettings() {
    P.skeleton($('st-apps'), 3);
    call('admin.settingsGet').then(function (res) {
      if (!res.ok) { $('st-apps').textContent = res.message; return; }
      ST = res;
      var m = res.maintenance;
      var flags = $('st-maint-state'); flags.textContent = '';
      flags.appendChild(m.on ? chip('🔧 กำลังปิดปรับปรุง' + (m.until ? ' · เปิดอัตโนมัติ ' + fmtDate(m.until) : ''), 'warn') : chip('✅ เปิดใช้งานปกติ', 'ok'));
      $('st-maint-on').checked = m.on;
      P.dateSet($('st-maint-until'), m.on ? toLocalInput(m.until) : '');
      $('st-maint-msg').value = m.on ? (m.message || '') : '';
      $('st-maint-open').hidden = !m.on;
      $('st-ttl').value = res.sessionHours;
      renderApps();
    });
  }
  function renderApps() {
    var wrap = $('st-apps'); wrap.textContent = '';
    if (!ST.childApps.length) { wrap.appendChild(el('p', 'empty', 'ยังไม่มีแอพลูก')); return; }
    ST.childApps.forEach(function (a) {
      var row = el('div', 'row static');
      var main = el('span', 'row-main');
      main.appendChild(el('span', 'row-title', a.name));
      main.appendChild(el('span', 'row-sub', a.id + (a.menuKeys.length ? ' · เมนู: ' + a.menuKeys.join(', ') : '')));
      var f = el('span', 'row-flags');
      f.appendChild(a.status === 'maintenance'
        ? chip('🔧 ปิดปรับปรุง' + (a.until ? ' ถึง ' + fmtDate(a.until) : ''), 'warn')
        : (a.status === 'inactive' ? chip('ปิดใช้งาน', 'muted') : chip('ใช้งานปกติ', 'ok')));
      main.appendChild(f);
      row.appendChild(main);
      var acts = el('span', 'row-actions');
      var b = el('button', 'btn btn-sm ' + (a.status === 'maintenance' ? 'btn-primary' : 'btn-edit'),
        a.status === 'maintenance' ? '▶️ เปิดใช้งาน' : '🔧 ปิดปรับปรุง');
      b.type = 'button';
      b.addEventListener('click', function () {
        if (a.status === 'maintenance') setApp(a, 'active', '', b);
        else { A.app = a; $('app-name').textContent = a.name; P.dateSet($('app-until'), ''); P.setAlert('app-alert', ''); openDlg($('dlg-app')); }
      });
      acts.appendChild(b); row.appendChild(acts);
      wrap.appendChild(row);
    });
  }
  function setApp(a, status, until, btn) {
    if (btn) P.busy(btn, true, 'กำลังบันทึก...');
    return call('admin.childAppSet', { appId: a.id, status: status, until: until }).then(function (res) {
      if (btn) P.busy(btn, false);
      if (!res.ok) { P.toast(res.message, 'err'); return res; }
      P.toast(res.message, 'ok'); loadSettings(); P.refreshProfile();
      return res;
    });
  }
  $('form-app').addEventListener('submit', function (e) {
    e.preventDefault();
    var until = fromLocalInput(P.dateGet($('app-until')));
    if (until && new Date(until).getTime() <= Date.now()) return P.setAlert('app-alert', 'เวลาเปิดอัตโนมัติต้องอยู่ในอนาคต');
    var btn = $('app-ok'); P.busy(btn, true, 'กำลังบันทึก...');
    setApp(A.app, 'maintenance', until).then(function (res) {
      P.busy(btn, false);
      if (res.ok) $('dlg-app').close(); else P.setAlert('app-alert', res.message);
    });
  });
  $('app-cancel').addEventListener('click', function () { $('dlg-app').close(); });

  function saveMaint(on) {
    var until = fromLocalInput(P.dateGet($('st-maint-until')));
    if (on && until && new Date(until).getTime() <= Date.now()) return P.toast('เวลาเปิดอัตโนมัติต้องอยู่ในอนาคต', 'err');
    var go = function () {
      var btn = $('st-maint-save'); P.busy(btn, true, 'กำลังบันทึก...');
      return call('admin.settingsSave', { maintenance: { on: on, until: on ? until : '', message: on ? $('st-maint-msg').value.trim() : '' } })
        .then(function (res) {
          P.busy(btn, false);
          if (!res.ok) { P.toast(res.message, 'err'); return res; }
          P.toast(on ? 'ปิดปรับปรุงระบบแล้ว — ผู้ใช้อื่นเข้าไม่ได้จนกว่าจะเปิด' : 'เปิดระบบแล้ว', 'ok');
          loadSettings(); P.refreshProfile();
          return res;
        });
    };
    if (on && !(ST && ST.maintenance.on)) {
      confirmBox('ปิดปรับปรุงระบบ', 'ผู้ใช้ทุกคนยกเว้น superadmin จะเข้าระบบไม่ได้ทันที (คนที่ใช้อยู่จะถูกให้ออกเมื่อโหลดหน้าใหม่)', false, go, 'ปิดปรับปรุง');
    } else go();
  }
  $('st-maint-save').addEventListener('click', function () { saveMaint($('st-maint-on').checked); });
  $('st-maint-open').addEventListener('click', function () { $('st-maint-on').checked = false; saveMaint(false); });
  $('st-ttl-save').addEventListener('click', function () {
    var h = Number($('st-ttl').value);
    if (!(h >= 1 && h <= 24) || Math.round(h) !== h) return P.toast('กรอกจำนวนชั่วโมง 1–24', 'err');
    var btn = $('st-ttl-save'); P.busy(btn, true, 'กำลังบันทึก...');
    call('admin.settingsSave', { sessionHours: h }).then(function (res) {
      P.busy(btn, false);
      P.toast(res.ok ? 'บันทึกแล้ว — มีผลกับการเข้าสู่ระบบครั้งถัดไป' : res.message, res.ok ? 'ok' : 'err');
    });
  });

  // ---------- จัดการเมนู (superadmin) ----------
  var MN = { menus: [], wg: [] };
  var ICON_PICKS = ['🏠', '📊', '📈', '👤', '👥', '📅', '🔁', '📋', '📌', '🗂️', '💊', '🧪', '🩺', '🦷', '🧠', '🏥', '🏘️', '📦', '🖥️', '📄', '🧾', '⚙️', '📁', '🔔'];
  function loadMenus(fresh) {
    P.swr('adm.menus', function () { return call('admin.menusList'); }, function (res) {
      if (!res.ok) { P.tableMsg($('mn-list'), res.message); return; }
      MN.menus = res.menus; MN.wg = res.workgroups;
      renderMenusAdmin();
    }, function () { P.skeleton($('mn-list'), 6); }, fresh === true);
  }
  function groupName(g) { return g === 'all' || !g ? 'ทั่วไป (ทุกกลุ่ม)' : ((MN.wg.filter(function (w) { return w.key === g; })[0] || {}).label || P.groupLabel(g)); }
  function renderMenusAdmin() {
    var wrap = $('mn-list'); wrap.textContent = '';
    var q = $('mn-search').value.trim().toLowerCase(), showOff = $('mn-inactive').checked;
    var vis = function (m) {
      return (showOff || m.status === 'active') && (!q || (m.name + ' ' + m.key).toLowerCase().indexOf(q) >= 0);
    };
    var tops = MN.menus.filter(function (m) { return !m.parentKey; });
    var kids = function (k) { return MN.menus.filter(function (m) { return m.parentKey === k; }); };
    var n = 0;
    tops.forEach(function (t) {
      var ch = kids(t.key).filter(vis);
      if (!vis(t) && !ch.length) return;
      wrap.appendChild(menuRow(t, false)); n++;
      ch.forEach(function (c) { wrap.appendChild(menuRow(c, true)); n++; });
    });
    if (!n) P.tableMsg(wrap, 'ไม่พบรายการ');
  }
  function menuRow(m, child) {
    var row = el('tr', (child ? 'child' : '') + (m.status !== 'active' ? ' off' : ''));
    var nm = el('td'); var box = el('span', 'gw7-mv-name');
    box.appendChild(el('span', 'gw7-mv-ic', m.icon && /[^\x00-\x7F]/.test(m.icon) ? m.icon : (child ? '📌' : '📁')));
    var t = el('span'); t.appendChild(el('b', null, m.name)); t.appendChild(el('span', 'gw7-mv-key', m.key));
    box.appendChild(t); nm.appendChild(box);
    if (child) nm.style.paddingLeft = '34px';
    row.appendChild(nm);
    var f = el('td');
    f.appendChild(el('span', 'gw-st ' + (m.status === 'active' ? 'on' : 'off'), m.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'));
    if (m.openMode === 'group' || (!child && MN.menus.some(function (x) { return x.parentKey === m.key; }))) { f.appendChild(document.createTextNode(' ')); f.appendChild(el('span', 'gw-st info', 'เมนูกลุ่ม')); }
    if (m.requireGateway) { f.appendChild(document.createTextNode(' ')); f.appendChild(el('span', 'gw-st warn', 'แอพลูก')); }
    row.appendChild(f);
    row.appendChild(el('td', null, m.allowedGroups.length ? m.allowedGroups.map(function (g) {
      return g === '@person' ? 'รายบุคคล' : (g === 'all' ? 'ทุกกลุ่ม' : P.groupLabel(g)); }).join(', ') : groupName(m.group)));
    var u = el('td'); u.appendChild(el('span', 'sub', m.url || '-')); row.appendChild(u);
    var acts = el('span', 'acts'); var at = el('td'); at.appendChild(acts); row.appendChild(at);
    [['▲', 'up'], ['▼', 'down']].forEach(function (x) {
      var b = el('button', 'gw-view', x[0]); b.type = 'button'; b.title = x[1] === 'up' ? 'เลื่อนขึ้น' : 'เลื่อนลง';
      b.addEventListener('click', function () {
        b.disabled = true;
        call('admin.menuMove', { key: m.key, dir: x[1] }).then(function (res) {
          if (!res.ok) return P.toast(res.message, 'err');
          loadMenus(true); P.refreshProfile();
        });
      });
      acts.appendChild(b);
    });
    var e = el('button', 'gw-edit', '✏️ แก้ไข'); e.type = 'button';
    e.addEventListener('click', function () { editMenu(m); });
    acts.appendChild(e);
    return row;
  }
  $('mn-search').addEventListener('input', renderMenusAdmin);
  $('mn-inactive').addEventListener('change', renderMenusAdmin);
  $('mn-new').addEventListener('click', function () { editMenu(null); });

  (function buildIconPicks() {
    var box = $('mn-icons');
    ICON_PICKS.forEach(function (ic) {
      var b = el('button', 'icon-pick', ic); b.type = 'button'; b.title = 'ใช้ไอคอนนี้';
      b.addEventListener('click', function () { $('mn-icon').value = ic; });
      box.appendChild(b);
    });
  })();

  function editMenu(m) {
    MN.editing = m;
    P.setAlert('mn-alert', '');
    $('mn-title').textContent = m ? '✏️ แก้ไขเมนู' : '➕ เพิ่มเมนู';
    var g = $('mn-group'); g.textContent = '';
    [{ key: 'all', label: 'ทั่วไป (ทุกกลุ่ม)' }].concat(MN.wg).forEach(function (w) {
      var o = el('option', null, w.label); o.value = w.key; g.appendChild(o);
    });
    var p = $('mn-parent'); p.textContent = '';
    var o0 = el('option', null, '— ไม่มี (เมนูระดับบนสุด) —'); o0.value = ''; p.appendChild(o0);
    MN.menus.filter(function (x) { return !x.parentKey && (!m || x.key !== m.key); }).forEach(function (x) {
      var o = el('option', null, (x.icon && /[^\x00-\x7F]/.test(x.icon) ? x.icon + ' ' : '') + x.name + ' (' + x.key + ')'); o.value = x.key; p.appendChild(o);
    });
    var al = $('mn-allowed'); al.textContent = '';
    [{ key: 'all', label: 'ทุกกลุ่ม' }, { key: '@person', label: 'เฉพาะคนที่ได้รับมอบ' }].concat(MN.wg).forEach(function (w) {
      var l = el('label', 'check'); var c = el('input'); c.type = 'checkbox'; c.value = w.key; c.name = 'mn-allowed';
      c.checked = !!(m && m.allowedGroups.indexOf(w.key) >= 0);
      l.appendChild(c); l.appendChild(el('span', null, w.label)); al.appendChild(l);
    });
    $('mn-key').value = m ? m.key : ''; $('mn-key').readOnly = !!m;
    $('mn-name').value = m ? m.name : '';
    $('mn-icon').value = m ? m.icon : '';
    $('mn-url').value = m ? m.url : '';
    g.value = m ? (m.group || 'all') : 'all';
    if (m && m.group && g.value !== m.group) { var og = el('option', null, m.group); og.value = m.group; g.appendChild(og); g.value = m.group; }
    p.value = m ? m.parentKey : '';
    $('mn-dept').value = m ? m.departmentName : '';
    $('mn-sort').value = m ? m.sort : '';
    $('mn-status').value = m ? m.status : 'active';
    $('mn-desc').value = m ? m.description : '';
    $('mn-isgroup').checked = !!(m && m.openMode === 'group');
    $('mn-gateway').checked = !!(m && m.requireGateway);
    $('mn-assign').checked = !!(m && m.assignable);
    openDlg($('dlg-menu'));
  }
  $('mn-cancel').addEventListener('click', function () { $('dlg-menu').close(); });
  $('form-menu').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = {
      isNew: !MN.editing, key: $('mn-key').value.trim(), name: $('mn-name').value.trim(), icon: $('mn-icon').value.trim(),
      url: $('mn-url').value.trim(), group: $('mn-group').value, parentKey: $('mn-parent').value,
      departmentName: $('mn-dept').value.trim(), sort: $('mn-sort').value === '' ? '' : Number($('mn-sort').value),
      status: $('mn-status').value, description: $('mn-desc').value.trim(),
      openMode: $('mn-isgroup').checked ? 'group' : '', requireGateway: $('mn-gateway').checked, assignable: $('mn-assign').checked,
      allowedGroups: Array.prototype.filter.call(document.querySelectorAll('input[name=mn-allowed]'), function (c) { return c.checked; })
        .map(function (c) { return c.value; })
    };
    if (!/^[a-z0-9_]{2,40}$/.test(f.key)) return P.setAlert('mn-alert', 'รหัสเมนูใช้ได้เฉพาะ a-z 0-9 _ ยาว 2–40 ตัว');
    if (!f.name) return P.setAlert('mn-alert', 'กรุณากรอกชื่อเมนู');
    if (f.url && !/^https:\/\//i.test(f.url) && !/^#[a-z0-9_]+$/i.test(f.url)) return P.setAlert('mn-alert', 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือเป็นหน้าในระบบ เช่น #logs');
    var btn = $('mn-save'); P.busy(btn, true, 'กำลังบันทึก...');
    call('admin.menuSave', { menu: f }).then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('mn-alert', res.message);
      $('dlg-menu').close();
      P.toast(res.message, 'ok');
      loadMenus(true); P.refreshProfile();
    });
  });

  // ---------- การใช้ทรัพยากร (1.8.0) ----------
  var APP_NAME = { ncd: 'NCD', ref: 'ส่งต่อ', adp: 'ผ้าอ้อม', wbc: 'WBC', arv: 'ARV', ic: 'IC', ltc: 'LTC', mr: 'เบิกพัสดุ', ita: 'ครุภัณฑ์ IT',
    cnr: 'กลุ่มเสี่ยง', oss: 'อสส.', eld: 'ผู้สูงอายุ', lvs: 'ลูกน้ำ', cdc: 'ควบคุมโรค', imc: 'IMC', scr: 'สังคมสงเคราะห์', svy: 'แบบสอบถาม',
    task: 'งาน/แจ้งเตือน', notif: 'แจ้งเตือน', auth: 'เข้าสู่ระบบ', admin: 'จัดการระบบ', pm: 'เวชระเบียนกลาง', psn: 'บุคลากร', gw: 'ส่วนกลาง', usage: 'หน้านี้', public: 'หน้าสาธารณะ', bridge: 'สะพาน Apps Script' };
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }
  function meter(label, used, limit, text) {
    var pct = limit ? Math.min(100, used / limit * 100) : 0;
    var box = el('div', 'us-meter');
    var head = el('div', 'us-mhead'); head.appendChild(el('b', '', label)); head.appendChild(el('span', '', text + ' · ' + pct.toFixed(1) + '%'));
    var bar = el('div', 'us-bar'), fill = el('i', pct >= 80 ? 'bad' : pct >= 60 ? 'warn' : 'ok'); fill.style.width = pct.toFixed(1) + '%';
    bar.appendChild(fill); box.appendChild(head); box.appendChild(bar);
    return box;
  }
  function loadUsage() {
    var body = $('usage-body'); body.textContent = ''; body.appendChild(el('p', 'muted', 'กำลังโหลด...'));
    call('usage.report', {}).then(function (res) {
      body.textContent = '';
      if (!res.ok) { body.appendChild(el('p', 'alert err', res.message || 'โหลดไม่สำเร็จ (ติดตั้ง SQL 26 + Edge 2.6.0 แล้วหรือยัง)')); return; }
      var rep = res.report || {}, lim = rep.limits || {}, tot = rep.total || {};
      var egLimit = (Number(lim.egressGb) || 5) * 1073741824, dbLimit = (Number(lim.dbMb) || 500) * 1048576, callLimit = Number(lim.edgeCalls) || 500000;
      var eg = Number(tot.db || 0) + Number(tot.out || 0);
      body.appendChild(el('p', 'muted', 'รอบบิล ' + P.fmtTime(rep.cycleStart, true) + ' – ' + P.fmtTime(rep.cycleEnd, true) + ' · นับโดยระบบของเราเอง (ใกล้เคียงหน้า Usage ของ Supabase · ไม่ต้องเปิดหน้า Logs ของ Supabase)'));
      body.appendChild(meter('Egress (ประมาณ)', eg, egLimit, fmtBytes(eg) + ' / ' + fmtBytes(egLimit)));
      body.appendChild(meter('ขนาดฐานข้อมูล', Number(rep.dbSize) || 0, dbLimit, fmtBytes(rep.dbSize) + ' / ' + fmtBytes(dbLimit)));
      body.appendChild(meter('เรียก Edge', Number(tot.calls) || 0, callLimit, (Number(tot.calls) || 0).toLocaleString('th-TH') + ' / ' + callLimit.toLocaleString('th-TH') + ' ครั้ง'));
      // แยกระบบ
      var byApp = {}, byDay = {};
      (rep.days || []).forEach(function (d) {
        var b = Number(d.db) + Number(d.out);
        var a = byApp[d.app] = byApp[d.app] || { bytes: 0, calls: 0 }; a.bytes += b; a.calls += Number(d.calls);
        byDay[d.day] = (byDay[d.day] || 0) + b;
      });
      body.appendChild(el('h4', 'us-h', 'แยกตามระบบ (รอบบิลนี้)'));
      var wrap = el('div', 'gw-table-wrap'), tb = el('table', 'gw-table'), th = el('thead'), tr = el('tr');
      ['ระบบ', 'ข้อมูลรับส่ง', 'ครั้ง', 'เฉลี่ย/ครั้ง'].forEach(function (h) { tr.appendChild(el('th', '', h)); });
      th.appendChild(tr); tb.appendChild(th);
      var tbody = el('tbody');
      Object.keys(byApp).sort(function (x, y) { return byApp[y].bytes - byApp[x].bytes; }).forEach(function (k) {
        var r = el('tr'), a = byApp[k];
        r.appendChild(el('td', '', APP_NAME[k] || k)); r.appendChild(el('td', '', fmtBytes(a.bytes)));
        r.appendChild(el('td', '', a.calls.toLocaleString('th-TH'))); r.appendChild(el('td', '', fmtBytes(a.calls ? a.bytes / a.calls : 0)));
        tbody.appendChild(r);
      });
      if (!tbody.children.length) { var er = el('tr'), td = el('td', 'muted', 'ยังไม่มีข้อมูล (เริ่มนับหลังติดตั้ง Edge 2.6.0)'); td.colSpan = 4; er.appendChild(td); tbody.appendChild(er); }
      tb.appendChild(tbody); wrap.appendChild(tb); body.appendChild(wrap);
      // รายวัน
      var days = Object.keys(byDay).sort(), mx = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
      if (days.length) {
        body.appendChild(el('h4', 'us-h', 'รายวัน (เป้าหมาย < 150 MB/วัน)'));
        var list = el('div', 'us-days');
        days.forEach(function (d) {
          var row = el('div', 'us-day'), bar = el('div', 'us-bar'), fill = el('i', byDay[d] > 157286400 ? 'bad' : 'ok');
          fill.style.width = (byDay[d] / mx * 100).toFixed(1) + '%'; bar.appendChild(fill);
          row.appendChild(el('span', 'us-dlabel', P.fmtTime(d, true))); row.appendChild(bar); row.appendChild(el('span', 'us-dval', fmtBytes(byDay[d])));
          list.appendChild(row);
        });
        body.appendChild(list);
      }
      // ตารางใหญ่สุด + ประวัติ
      body.appendChild(el('h4', 'us-h', 'ตารางที่ใหญ่ที่สุด'));
      var ul = el('ul', 'us-tables');
      (rep.tables || []).forEach(function (t) { ul.appendChild(el('li', '', t.name + ' — ' + fmtBytes(t.bytes))); });
      body.appendChild(ul);
      var au = rep.audit || {};
      body.appendChild(el('p', 'muted', 'ประวัติการแก้ไขในฐานข้อมูล ' + (Number(au.rows) || 0).toLocaleString('th-TH') + ' แถว' +
        (au.oldest ? ' · เก่าสุด ' + P.fmtTime(au.oldest, true) : '') + ' · เก่ากว่า 1 ปีส่งออกไป Drive ทุกวันที่ 1 ของเดือน'));
    });
  }

  window.PHC37Admin = { open: open };
})();
