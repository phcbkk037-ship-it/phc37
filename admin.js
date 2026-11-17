/* PHC37 PWA — admin.js (PHC37-PWA-ADMIN-1.0.0) : จัดการระบบกลาง */
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
      return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
    } catch (e) { return iso; }
  }
  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function appUrl() { return location.href.split('#')[0].split('?')[0]; }

  // ---------- เปิดหน้า ----------
  function open() {
    P.show('view-admin');
    window.scrollTo(0, 0);
    try { history.pushState({ phc37Admin: 1 }, ''); } catch (e) {}
    switchTab('users');
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
    ['users', 'requests', 'bulk'].forEach(function (t) { $('tab-' + t).hidden = t !== tab; });
    if (tab === 'requests') loadRequests();
    if (tab === 'bulk') loadBulk(false);
  }
  Array.prototype.forEach.call(document.querySelectorAll('#view-admin .tab'), function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.tab); });
  });

  // ---------- ตัวเลือก ----------
  function fillOptions() {
    var b = A.boot;
    var role = $('u-role'); role.textContent = '';
    b.roles.forEach(function (r) { var o = el('option', null, P.roleLabel(r.key)); o.value = r.key; role.appendChild(o); });
    var dp = $('dl-positions'); dp.textContent = '';
    b.positions.forEach(function (v) { var o = el('option'); o.value = v; dp.appendChild(o); });
    var da = $('dl-affiliations'); da.textContent = '';
    b.affiliations.forEach(function (v) { var o = el('option'); o.value = v; da.appendChild(o); });
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
      role: 'staff', status: 'active', userType: 'main', menuKeys: [] };
    $('u-username').value = src.username || '';
    $('u-fullname').value = src.fullName || '';
    $('u-email').value = src.email || '';
    $('u-role').value = src.role || (A.boot.roles.some(function (r) { return r.key === 'staff'; }) ? 'staff' : A.boot.roles[0].key);
    if (src.role && $('u-role').value !== src.role) {   // role ที่ admin ตั้งไม่ได้ (ไม่น่าเกิด) → แสดงไว้
      var o = el('option', null, P.roleLabel(src.role)); o.value = src.role; $('u-role').appendChild(o); $('u-role').value = src.role;
    }
    $('u-position').value = src.position || '';
    $('u-affiliation').value = src.affiliation || '';
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
      role: $('u-role').value, position: $('u-position').value.trim(), affiliation: $('u-affiliation').value.trim(),
      userType: $('u-type').value, status: $('u-status').value, groups: getChecks('grp'), menuKeys: getChecks('menu')
    };
    if (!f.username || !f.fullName) return P.setAlert('user-alert', 'กรุณากรอกชื่อผู้ใช้และชื่อ-สกุล');
    if (f.email && !P.emailOk(f.email)) return P.setAlert('user-alert', 'รูปแบบอีเมลไม่ถูกต้อง');
    if (f.role !== 'superadmin' && !f.groups.length) return P.setAlert('user-alert', 'กรุณาเลือกกลุ่มงานอย่างน้อย 1 กลุ่ม');
    var btn = $('u-save'); P.busy(btn, true, 'กำลังบันทึก...');
    var req = A.mode === 'approve'
      ? call('admin.approveRequest', { requestId: A.request.id, role: f.role, groups: f.groups, menuKeys: f.menuKeys, userType: f.userType })
      : call('admin.saveUser', { user: f });
    req.then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('user-alert', res.message);
      $('dlg-user').close();
      upsertLocal(res.user);
      if (A.mode === 'approve') {
        P.toast('อนุมัติคำขอแล้ว', 'ok');
        loadRequests();
        if (res.temp && res.temp.ok) showTemp(res.temp);
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
    var wrap = $('adm-requests'); wrap.textContent = '';
    wrap.appendChild(el('p', 'muted', 'กำลังโหลด...'));
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
    $('bulk-summary').textContent = 'กำลังโหลด...';
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

  window.PHC37Admin = { open: open };
})();
