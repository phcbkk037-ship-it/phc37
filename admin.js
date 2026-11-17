/* PHC37 PWA — admin.js (PHC37-PWA-ADMIN-1.3.0) : จัดการระบบกลาง + สิทธิ์เมนู + ประวัติการใช้งาน */
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

  function open(mode) {
    P.show('view-admin');
    window.scrollTo(0, 0);
    try { history.pushState({ phc37Admin: 1 }, ''); } catch (e) {}
    var admin = isAdminRole();
    $('adm-title').textContent = admin ? '⚙️ จัดการระบบกลาง' : '🧾 ประวัติการใช้งานของฉัน';
    Array.prototype.forEach.call(document.querySelectorAll('#view-admin .tab'), function (t) {
      t.hidden = !admin || (t.dataset.super && myRole() !== 'superadmin');
    });
    document.querySelector('#view-admin .tabs').hidden = !admin;
    if (!admin || mode === 'logs') { switchTab('logs'); if (!admin) return; }
    else switchTab('users');
    P.loading(true, 'กำลังโหลดข้อมูลผู้ใช้...');
    Promise.all([call('admin.bootstrap'), call('admin.listUsers')]).then(function (r) {
      P.loading(false);
      if (!r[0].ok) { P.toast(r[0].message, 'err'); if (r[0].code === 'forbidden') P.goHome(); return; }
      A.boot = r[0];
      A.users = r[1].ok ? r[1].users : [];
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

  function setBadge(n) { var b = $('adm-req-badge'); b.textContent = n || ''; b.hidden = !n; }

  // ---------- แท็บ ----------
  function switchTab(tab) {
    A.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('#view-admin .tab'), function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    ['users', 'requests', 'perms', 'menus', 'logs', 'bulk', 'settings'].forEach(function (t) { $('tab-' + t).hidden = t !== tab; });
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

  // ---------- ตัวเลือก ----------
  function fillOptions() {
    var b = A.boot;
    var role = $('u-role'); role.textContent = '';
    b.roles.forEach(function (r) { var o = el('option', null, P.roleLabel(r.key)); o.value = r.key; role.appendChild(o); });
    P.comboFill('u-position', b.positions, '— ไม่ระบุ —', b.positionGroups);
    P.comboFill('u-affiliation', b.affiliations, '— ไม่ระบุ —');
    var gw = $('u-groups'); gw.textContent = '';
    b.workgroups.forEach(function (g) {
      var l = el('label', 'check');
      var c = el('input'); c.type = 'checkbox'; c.value = g.key; c.name = 'grp';
      l.appendChild(c); l.appendChild(el('span', null, g.label));
      gw.appendChild(l);
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
    if (!order.length) mw.appendChild(el('p', 'muted', 'ไม่มีระบบงานที่มอบหมายได้'));
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
    $('adm-count').textContent = 'แสดง ' + list.length + ' จาก ' + A.users.length + ' คน';
    var wrap = $('adm-users'); wrap.textContent = '';
    if (!list.length) { wrap.appendChild(el('p', 'empty', 'ไม่พบผู้ใช้ตามเงื่อนไข')); return; }
    list.forEach(function (u) {
      var row = el('button', 'row'); row.type = 'button'; row.dataset.id = u.id;
      var av = el('span', 'avatar', (u.fullName || '?').charAt(0));
      var main = el('span', 'row-main');
      main.appendChild(el('span', 'row-title', u.fullName));
      main.appendChild(el('span', 'row-sub', u.username + ' · ' + P.roleLabel(u.role) +
        (u.groups.length ? ' · ' + u.groups.map(P.groupLabel).join(', ') : '')));
      var flags = el('span', 'row-flags');
      userFlags(u).forEach(function (x) { flags.appendChild(chip(x[0], x[1])); });
      main.appendChild(flags);
      row.appendChild(av); row.appendChild(main); row.appendChild(el('span', 'row-edit', '✏️'));
      row.addEventListener('click', function () { editUser(u); });
      wrap.appendChild(row);
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
        loadRequests();
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
    renderUsers();
  }
  function refreshUsers() {
    return call('admin.listUsers').then(function (r) { if (r.ok) { A.users = r.users; renderUsers(); } });
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
  function loadRequests() {
    var wrap = $('adm-requests'); P.skeleton(wrap, 3);
    call('admin.listRequests').then(function (res) {
      wrap.textContent = '';
      if (!res.ok) { wrap.appendChild(el('p', 'empty', res.message)); return; }
      A.requests = res.requests;
      var pending = res.requests.filter(function (r) { return r.status === 'pending'; });
      setBadge(pending.length);
      if (!res.requests.length) { wrap.appendChild(el('p', 'empty', 'ยังไม่มีคำขอสมัครใช้งาน')); return; }
      res.requests.forEach(function (r) {
        var card = el('div', 'row static');
        var main = el('span', 'row-main');
        main.appendChild(el('span', 'row-title', r.fullName));
        main.appendChild(el('span', 'row-sub', r.username + (r.position ? ' · ' + r.position : '') +
          (r.workgroup ? ' · ' + P.groupLabel(r.workgroup) : '') + ' · ยื่น ' + fmtDate(r.createdAt)));
        var flags = el('span', 'row-flags');
        if (r.status === 'pending') flags.appendChild(chip('รออนุมัติ', 'warn'));
        if (r.status === 'approved') flags.appendChild(chip('อนุมัติแล้ว โดย ' + r.processedBy, 'ok'));
        if (r.status === 'rejected') flags.appendChild(chip('ไม่อนุมัติ: ' + r.rejectReason, 'danger'));
        if (!r.email) flags.appendChild(chip('ไม่มีอีเมล', 'muted'));
        main.appendChild(flags);
        card.appendChild(main);
        if (r.status === 'pending') {
          var acts = el('span', 'row-actions');
          var ok = el('button', 'btn btn-primary btn-sm', '✅ อนุมัติ'); ok.type = 'button';
          ok.addEventListener('click', function () { editUser(null, r); });
          var no = el('button', 'btn btn-danger-soft btn-sm', '✖️ ไม่อนุมัติ'); no.type = 'button';
          no.addEventListener('click', function () {
            confirmBox('ไม่อนุมัติคำขอ', 'ไม่อนุมัติคำขอของ "' + r.fullName + '"', true, function (reason) {
              return call('admin.rejectRequest', { requestId: r.id, reason: reason }).then(function (res2) {
                if (res2.ok) { P.toast(res2.message, 'ok'); loadRequests(); }
                return res2;
              });
            }, 'ยืนยันไม่อนุมัติ');
          });
          acts.appendChild(ok); acts.appendChild(no); card.appendChild(acts);
        }
        wrap.appendChild(card);
      });
    });
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
    if (!order.length) { var tr = el('tr'); var td = el('td', 'muted', 'ไม่พบเมนู'); td.colSpan = 5; tr.appendChild(td); body.appendChild(tr); }
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
  var ACTION_LABEL = {
    LOGIN_SUCCESS: 'เข้าสู่ระบบ', LOGIN_FAILED: 'เข้าสู่ระบบไม่สำเร็จ', LOGIN_NEEDS_NEW_PASSWORD: 'เข้าด้วยรหัสชั่วคราว',
    LOGIN_BLOCKED_MAINTENANCE: 'ถูกกันช่วงปิดปรับปรุง', PASSWORD_SET_FIRST: 'ตั้งรหัสผ่านครั้งแรก', PASSWORD_CHANGED: 'เปลี่ยนรหัสผ่าน',
    PASSWORD_CHANGE_FAILED: 'เปลี่ยนรหัสไม่สำเร็จ', EMAIL_SET: 'บันทึกอีเมล', REGISTER_REQUEST: 'ส่งคำขอสมัคร',
    REGISTER_APPROVE: 'อนุมัติคำขอสมัคร', REGISTER_REJECT: 'ไม่อนุมัติคำขอสมัคร', USER_CREATE: 'เพิ่มผู้ใช้', USER_UPDATE: 'แก้ไขผู้ใช้',
    USER_STATUS: 'เปลี่ยนสถานะผู้ใช้', USER_UNLOCK: 'ปลดล็อกบัญชี', TEMP_PASSWORD_ISSUED: 'ออกรหัสชั่วคราว',
    TEMP_PASSWORD_EMAILED: 'ส่งรหัสชั่วคราวทางอีเมล', ROLE_PERMISSION_UPDATE: 'แก้สิทธิ์เมนูราย Role',
    MENU_CREATE: 'เพิ่มเมนู', MENU_UPDATE: 'แก้ไขเมนู', MENU_MOVE: 'เลื่อนลำดับเมนู',
    MAINTENANCE_ON: 'ปิดปรับปรุงระบบ', MAINTENANCE_OFF: 'เปิดระบบหลังปรับปรุง', SETTINGS_UPDATE: 'แก้ตั้งค่าระบบ', CHILD_APP_STATUS: 'เปลี่ยนสถานะแอพลูก',
    FORGOT_PASSWORD_CODE_SENT: 'ขอรหัสยืนยัน (ลืมรหัส)', FORGOT_PASSWORD_NOMATCH: 'ลืมรหัส: ข้อมูลไม่ตรง',
    FORGOT_PASSWORD_BAD_CODE: 'ลืมรหัส: รหัสยืนยันผิด', PASSWORD_RESET_BY_EMAIL: 'ตั้งรหัสใหม่ทางอีเมล', MIGRATION_RUN: 'ย้ายข้อมูล'
  };
  var LG = { rows: [], next: null, inited: false };
  function dateStr(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function initLogs() {
    if (!LG.inited) {
      LG.inited = true;
      var sel = $('log-action');
      var o0 = el('option', null, 'ทั้งหมด'); o0.value = ''; sel.appendChild(o0);
      Object.keys(ACTION_LABEL).forEach(function (k) { var o = el('option', null, ACTION_LABEL[k]); o.value = k; sel.appendChild(o); });
      var to = new Date(), from = new Date(Date.now() - 6 * 86400000);
      P.dateSet($('log-from'), dateStr(from)); P.dateSet($('log-to'), dateStr(to));
    }
    $('log-user').closest('label').hidden = !isAdminRole();
    loadLogs(false);
    if (isAdminRole()) {
      call('logs.summary').then(function (res) {
        var a = $('log-alerts');
        if (!res.ok || !res.alerts.length) { a.hidden = true; return; }
        a.textContent = '⚠️ 24 ชั่วโมงที่ผ่านมา มีการใส่รหัสผิด/รหัสยืนยันผิดบ่อย: ' +
          res.alerts.map(function (x) { return x.username + ' (' + x.count + ' ครั้ง)'; }).join(', ');
        a.hidden = false;
      });
    }
  }
  function logQuery() {
    var from = P.dateGet($('log-from')), to = P.dateGet($('log-to'));
    return {
      from: from ? from + 'T00:00:00+07:00' : '',
      to: to ? new Date(new Date(to + 'T00:00:00+07:00').getTime() + 86400000).toISOString() : '',
      action: $('log-action').value, user: $('log-user').value.trim(), result: $('log-fail').checked ? 'fail' : '', limit: 100
    };
  }
  function loadLogs(more) {
    var q = logQuery();
    if (more && LG.next) q.before = LG.next;
    if (!more) { LG.rows = []; P.skeleton($('log-list'), 5); P.skeleton($('log-count'), 1, 'line'); }
    var btn = $('log-more'); if (more) P.busy(btn, true, 'กำลังโหลด...');
    call('logs.list', q).then(function (res) {
      if (more) P.busy(btn, false);
      else $('log-list').textContent = '';
      if (!res.ok) { $('log-count').textContent = res.message; return; }
      LG.next = res.nextBefore;
      LG.rows = LG.rows.concat(res.logs);
      res.logs.forEach(function (l) { $('log-list').appendChild(logRow(l)); });
      $('log-count').textContent = 'แสดง ' + LG.rows.length + ' รายการ' + (res.nextBefore ? ' (มีเพิ่ม)' : '') +
        (res.scope === 'group' ? ' · เฉพาะผู้ใช้ในกลุ่มงานของคุณ' : '');
      btn.hidden = !res.nextBefore;
      if (!LG.rows.length) $('log-list').appendChild(el('p', 'empty', 'ไม่พบประวัติในช่วงที่เลือก'));
    });
  }
  function logRow(l) {
    var row = el('div', 'row static log-row' + (l.result === 'fail' ? ' fail' : ''));
    var main = el('span', 'row-main');
    var title = el('span', 'row-title', (l.result === 'fail' ? '⚠️ ' : '') + (ACTION_LABEL[l.action] || l.action));
    main.appendChild(title);
    var who = l.actor + (l.targetId && l.targetId !== l.actor ? ' → ' + (l.targetLabel || l.targetId) : '');
    main.appendChild(el('span', 'row-sub', fmtDate(l.at) + ' · ' + who));
    if (l.detail) main.appendChild(el('span', 'log-detail', l.detail));
    row.appendChild(main);
    return row;
  }
  $('log-search').addEventListener('click', function () { loadLogs(false); });
  $('log-more').addEventListener('click', function () { loadLogs(true); });
  $('log-csv').addEventListener('click', function () {
    if (!LG.rows.length) return P.toast('ยังไม่มีข้อมูลให้ดาวน์โหลด');
    var esc = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['เวลา', 'ผู้ใช้', 'Role', 'เหตุการณ์', 'รหัสเหตุการณ์', 'เป้าหมาย', 'รายละเอียด', 'ผล'].join(',')];
    LG.rows.forEach(function (l) {
      lines.push([fmtDate(l.at), l.actor, l.role, ACTION_LABEL[l.action] || l.action, l.action,
        l.targetLabel || l.targetId, l.detail, l.result].map(esc).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'phc37-logs-' + dateStr(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

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
  function loadMenus() {
    P.skeleton($('mn-list'), 6);
    call('admin.menusList').then(function (res) {
      if (!res.ok) { $('mn-list').textContent = res.message; return; }
      MN.menus = res.menus; MN.wg = res.workgroups;
      renderMenusAdmin();
    });
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
    if (!n) wrap.appendChild(el('p', 'empty', 'ไม่พบเมนู'));
  }
  function menuRow(m, child) {
    var row = el('div', 'row static menu-row' + (child ? ' child' : '') + (m.status !== 'active' ? ' off' : ''));
    row.appendChild(el('span', 'tile-icon sm', m.icon && /[^\x00-\x7F]/.test(m.icon) ? m.icon : (child ? '📌' : '📁')));
    var main = el('span', 'row-main');
    main.appendChild(el('span', 'row-title', m.name));
    main.appendChild(el('span', 'row-sub', m.key + ' · ' + groupName(m.group) + (m.url ? ' · ' + m.url : '')));
    var f = el('span', 'row-flags');
    if (m.status !== 'active') f.appendChild(chip('ปิดใช้งาน', 'danger'));
    if (m.openMode === 'group' || (!child && MN.menus.some(function (x) { return x.parentKey === m.key; }))) f.appendChild(chip('เมนูกลุ่ม', 'ok'));
    if (m.requireGateway) f.appendChild(chip('แอพลูก', 'info'));
    if (m.allowedGroups.length) f.appendChild(chip('เห็น: ' + m.allowedGroups.map(function (g) {
      return g === '@person' ? 'รายบุคคล' : (g === 'all' ? 'ทุกกลุ่ม' : P.groupLabel(g)); }).join(', '), 'muted'));
    main.appendChild(f);
    row.appendChild(main);
    var acts = el('span', 'row-actions');
    [['▲', 'up'], ['▼', 'down']].forEach(function (x) {
      var b = el('button', 'btn btn-ghost btn-sm', x[0]); b.type = 'button'; b.title = x[1] === 'up' ? 'เลื่อนขึ้น' : 'เลื่อนลง';
      b.addEventListener('click', function () {
        b.disabled = true;
        call('admin.menuMove', { key: m.key, dir: x[1] }).then(function (res) {
          if (!res.ok) return P.toast(res.message, 'err');
          loadMenus(); P.refreshProfile();
        });
      });
      acts.appendChild(b);
    });
    var e = el('button', 'btn btn-edit btn-sm', '✏️ แก้ไข'); e.type = 'button';
    e.addEventListener('click', function () { editMenu(m); });
    acts.appendChild(e);
    row.appendChild(acts);
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
      loadMenus(); P.refreshProfile();
    });
  });

  window.PHC37Admin = { open: open };
})();
