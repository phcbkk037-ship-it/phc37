/* PHC37 PWA — personnel.js (PHC37-PWA-PERSONNEL-1.0.0) : ทะเบียนบุคลากรกลาง — หน้าในแอป หน้าตาและการใช้งานตามระบบเดิม
 * การ์ดสรุป 5 ใบ (กดกรองได้) · ค้นหา + ระดับสิทธิ์ + กลุ่มงาน · ตาราง 9 คอลัมน์ (ดูงาน / ดู-แก้ / ปิดสถานะ) · 15 แถวต่อหน้า
 * ฟอร์ม 5 ส่วน: บัญชีผู้ใช้ · ข้อมูลบุคลากร · กลุ่มงาน/ตำแหน่ง · ชุมชนที่รับผิดชอบ (กลุ่มงานเยี่ยมบ้าน) · การแจ้งเตือน
 * ไม่เก็บข้อมูลบุคลากรไว้ในเครื่อง — เก็บเฉพาะตัวเลขการ์ดสรุป */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function call(action, data) { data = data || {}; data.token = P.token(); return P.api(action, data); }
  function guard(res) {
    if (res && !res.ok && res.code === 'unauthorized') { P.showLogin(res.message); return false; }
    return true;
  }
  function btn(text, cls, onClick) {
    var b = el('button', 'psn-btn' + (cls ? ' ' + cls : ''), text); b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function opt(sel, value, text, selected) {
    var o = el('option', null, text === undefined ? value : text); o.value = value;
    if (selected) o.selected = true;
    sel.appendChild(o); return o;
  }
  function field(label, input, cls) {
    var f = el('div', 'psn-f' + (cls ? ' ' + cls : ''));
    var l = el('label', null, label);
    if (input.id) l.htmlFor = input.id;
    f.appendChild(l); f.appendChild(input); return f;
  }
  function inp(id, ph, type) { var i = el('input', 'psn-in'); i.id = id; i.type = type || 'text'; if (ph) i.placeholder = ph; return i; }
  function sel(id, items, ph) {
    var s = el('select', 'psn-sel'); s.id = id;
    if (ph !== undefined) opt(s, '', ph);
    (items || []).forEach(function (x) { if (typeof x === 'string') opt(s, x); else opt(s, x.value, x.text); });
    return s;
  }
  function section(icon, title) {
    var s = el('div', 'psn-sec'), h = el('div', 'psn-sech');
    var i = el('div', 'psn-seci', icon); i.setAttribute('aria-hidden', 'true');
    h.appendChild(i); h.appendChild(el('div', 'psn-sect', title)); s.appendChild(h);
    return s;
  }

  // หมวดกลุ่มงาน (ตามระบบเดิม)
  var WG_CAT = {
    admin_office: 'กลุ่มบริหาร/สนับสนุน', hr: 'กลุ่มบริหาร/สนับสนุน',
    opd: 'กลุ่มบริการสุขภาพ', dental: 'กลุ่มบริการสุขภาพ', physical_therapy: 'กลุ่มบริการสุขภาพ', mental_health: 'กลุ่มบริการสุขภาพ', pharmacy: 'กลุ่มบริการสุขภาพ',
    homecare: 'กลุ่มงานชุมชน/สังคม', social_work: 'กลุ่มงานชุมชน/สังคม', school_health: 'กลุ่มงานชุมชน/สังคม', environment: 'กลุ่มงานชุมชน/สังคม', bhz7: 'กลุ่มงานชุมชน/สังคม',
    medical_records: 'กลุ่มระบบ/ข้อมูล', it: 'กลุ่มระบบ/ข้อมูล'
  };
  var WG_ORDER = ['กลุ่มบริหาร/สนับสนุน', 'กลุ่มบริการสุขภาพ', 'กลุ่มงานชุมชน/สังคม', 'กลุ่มระบบ/ข้อมูล', 'อื่น ๆ'];
  var HOMECARE = 'homecare';
  var CAT_TITLE = { all: 'รายชื่อบุคลากรทั้งหมด', active: 'บุคลากรที่บัญชีใช้งาน', inactive: 'บุคลากรที่ปิดใช้งาน', external: 'บุคลากรภายนอก' };

  var S = { built: false, ov: null, menu: null, cat: 'all', page: 1, seq: 0, rows: [], rec: null, saving: false };

  // ---------------------------------------------------------------------
  // โครงหน้า (สร้างครั้งเดียว)
  // ---------------------------------------------------------------------
  function build() {
    if (S.built) return;
    S.built = true;
    var v = $('view-personnel');
    v.appendChild(el('div', 'psn-notice')).id = 'psn-notice';
    $('psn-notice').hidden = true;
    var k = el('section', 'psn-kpis'); k.id = 'psn-kpis'; k.setAttribute('aria-label', 'สรุปทะเบียนบุคลากร');
    [['all', 'บุคลากรทั้งหมด'], ['active', 'บัญชี Active'], ['inactive', 'บัญชี Inactive'], ['external', 'บุคลากรภายนอก']].forEach(function (c) {
      var b = el('button', 'psn-kpi'); b.type = 'button'; b.dataset.cat = c[0];
      b.appendChild(el('span', 't', c[1])); var val = el('span', 'v', '-'); val.id = 'psn-k-' + c[0]; b.appendChild(val);
      b.addEventListener('click', function () { S.cat = c[0]; S.page = 1; search(); });
      k.appendChild(b);
    });
    var pc = el('div', 'psn-kpi'); pc.appendChild(el('span', 't', 'สิทธิ์การใช้งาน'));
    var pv = el('span', 'v sm', '-'); pv.id = 'psn-k-perm'; pc.appendChild(pv); k.appendChild(pc);
    v.appendChild(k);

    var panel = el('section', 'psn-panel');
    var head = el('div', 'psn-head'), ht = el('div');
    var title = el('span', 'psn-title', CAT_TITLE.all); title.id = 'psn-title';
    var note = el('span', 'psn-note'); note.id = 'psn-note'; note.setAttribute('role', 'status');
    ht.appendChild(title); ht.appendChild(note); head.appendChild(ht);
    var acts = el('div', 'psn-actions');
    acts.appendChild(btn('🏠 กลับเมนูหลัก', '', function () { P.goHome(); }));
    var rf = btn('รีเฟรช', '', function () { loadOverview(true); search(); }); rf.id = 'psn-refresh'; acts.appendChild(rf);
    var add = btn('+ เพิ่มบุคลากร', 'pri', function () { openForm(null); }); add.id = 'psn-add'; add.hidden = true; acts.appendChild(add);
    head.appendChild(acts); panel.appendChild(head);

    var fl = el('div', 'psn-filters');
    var kw = inp('psn-q', 'ค้นหาชื่อ ผู้ใช้ กลุ่มงาน ตำแหน่ง หรือชุมชน', 'search'); kw.setAttribute('aria-label', 'ค้นหารายชื่อบุคลากร');
    kw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { S.page = 1; search(); } });
    var rs = sel('psn-role', [], 'ทุกระดับสิทธิ์'); rs.setAttribute('aria-label', 'กรองตามระดับสิทธิ์');
    var gs = sel('psn-group', [], 'ทุกกลุ่มงาน'); gs.setAttribute('aria-label', 'กรองตามกลุ่มงาน');
    [rs, gs].forEach(function (s) { s.addEventListener('change', function () { S.page = 1; search(); }); });
    fl.appendChild(kw); fl.appendChild(rs); fl.appendChild(gs);
    fl.appendChild(btn('ค้นหา', 'pri', function () { S.page = 1; search(); }));
    panel.appendChild(fl);

    var wrap = el('div', 'psn-tablewrap'); wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'ตารางรายชื่อบุคลากร'); wrap.tabIndex = 0;
    var t = el('table', 'psn-table'), th = el('thead'), tr = el('tr');
    ['ชื่อ-นามสกุล', 'ชื่อผู้ใช้', 'กลุ่มงาน', 'ชุมชนรับผิดชอบ', 'ตำแหน่ง', 'ระดับสิทธิ์', 'สถานะ', 'แจ้งเตือน', 'จัดการ'].forEach(function (h) { tr.appendChild(el('th', null, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody'); tb.id = 'psn-tbody'; t.appendChild(tb);
    wrap.appendChild(t); panel.appendChild(wrap);
    var pg = el('div', 'psn-pager'); pg.id = 'psn-pager'; panel.appendChild(pg);
    v.appendChild(panel);
  }

  // ---------------------------------------------------------------------
  // เปิดหน้า
  // ---------------------------------------------------------------------
  function open(menu) {
    S.menu = menu || S.menu;
    build();
    call('personnel.overview').then(function (r) {
      if (!guard(r)) return;
      if (!r.ok && r.code === 'not_live') {   // ช่วงทดสอบ: ยังไม่เปิดให้บทบาทนี้ → ใช้ระบบเดิมตามเดิม
        if (S.menu && P.openMenu) P.openMenu(S.menu); else P.toast(r.message);
        return;
      }
      P.show('view-personnel');
      P.setPage('personnel', (S.menu && S.menu.name) || 'ทะเบียนบุคลากรกลาง');
      try { history.pushState({ phc37View: 'personnel' }, ''); } catch (e) {}
      window.scrollTo(0, 0);
      if (!r.ok) { notice(r.message); P.tableMsg($('psn-tbody'), r.message); return; }
      applyOverview(r);
      search();
    });
  }
  function notice(text) { var n = $('psn-notice'); n.hidden = !text; n.textContent = text || ''; }
  function loadOverview() {
    return call('personnel.overview').then(function (r) { if (guard(r) && r.ok) applyOverview(r); return r; });
  }
  function applyOverview(r) {
    S.ov = r;
    notice('');
    ['all', 'active', 'inactive', 'external'].forEach(function (c) {
      var n = { all: r.cards.total, active: r.cards.active, inactive: r.cards.inactive, external: r.cards.external }[c];
      $('psn-k-' + c).textContent = Number(n || 0).toLocaleString('th-TH');
    });
    var pm = [];
    if (r.perm.canView) pm.push('ดู'); if (r.perm.canAdd) pm.push('เพิ่ม'); if (r.perm.canEdit) pm.push('แก้ไข'); if (r.perm.canDelete) pm.push('ลบ');
    $('psn-k-perm').textContent = pm.join(' · ') + (r.scope === 'self' ? ' (ข้อมูลของฉัน)' : '');
    $('psn-add').hidden = !r.perm.canAdd;
    var rs = $('psn-role'), gs = $('psn-group'), rv = rs.value, gv = gs.value;
    rs.length = 1; gs.length = 1;
    r.lists.roles.forEach(function (x) { opt(rs, x.key, x.label || x.key); });
    r.lists.workGroups.forEach(function (g) { opt(gs, g.key, g.label); });
    rs.value = rv; gs.value = gv;
    var showFilters = r.scope === 'all';
    rs.hidden = gs.hidden = !showFilters;
  }
  function groupLabel(k) {
    var g = S.ov && S.ov.lists.workGroups.filter(function (x) { return x.key === k; })[0];
    return g ? g.label : P.groupLabel(k);
  }

  // ---------------------------------------------------------------------
  // ค้นหา + ตาราง
  // ---------------------------------------------------------------------
  function skeleton() {
    var tb = $('psn-tbody'); tb.textContent = '';
    for (var i = 0; i < 4; i++) {
      var tr = el('tr'); tr.setAttribute('aria-hidden', 'true');
      for (var j = 0; j < 9; j++) { var td = el('td'), s = el('span', 'psn-sk'); s.style.width = (50 + ((i + j) * 13) % 40) + '%'; td.appendChild(s); tr.appendChild(td); }
      tb.appendChild(tr);
    }
  }
  function search() {
    var seq = ++S.seq;
    Array.prototype.forEach.call(document.querySelectorAll('#psn-kpis .psn-kpi[data-cat]'), function (b) { b.classList.toggle('on', b.dataset.cat === S.cat); });
    $('psn-title').textContent = CAT_TITLE[S.cat] || CAT_TITLE.all;
    $('psn-note').textContent = 'กำลังโหลด…';
    if (!S.rows.length) skeleton();
    return call('personnel.search', { keyword: $('psn-q').value, role: $('psn-role').value, group: $('psn-group').value, category: S.cat, page: S.page, pageSize: 15 })
      .then(function (r) {
        if (seq !== S.seq) return;
        $('psn-note').textContent = '';
        if (!guard(r)) return;
        if (!r.ok) { P.tableMsg($('psn-tbody'), r.message || 'โหลดข้อมูลไม่สำเร็จ'); return; }
        S.rows = r.rows; S.page = r.page;
        render(r);
      });
  }
  function render(r) {
    var tb = $('psn-tbody'); tb.textContent = '';
    if (!r.rows.length) { P.tableMsg(tb, 'ไม่พบข้อมูลในหมวดนี้'); }
    r.rows.forEach(function (p) {
      var tr = el('tr'); if (p.recordStatus === 'inactive') tr.className = 'closed';
      function td(label) { var c = el('td'); c.dataset.label = label; tr.appendChild(c); return c; }
      var c1 = td('ชื่อ-นามสกุล'); c1.appendChild(el('b', null, p.fullName)); c1.appendChild(el('div', 'psn-sub', p.id));
      td('ชื่อผู้ใช้').textContent = p.username || '-';
      var c3 = td('กลุ่มงาน'); c3.appendChild(document.createTextNode(p.groups.map(groupLabel).join(', ') || '-'));
      if (p.groups.length > 1) c3.appendChild(el('div', 'psn-sub', 'หลายกลุ่มงาน'));
      var hc = p.groups.indexOf(HOMECARE) >= 0;
      if (hc) c3.appendChild(el('span', 'psn-tag-hc', 'กลุ่มงานเยี่ยมบ้าน'));
      var c4 = td('ชุมชนรับผิดชอบ');
      if (!hc) c4.appendChild(el('span', 'psn-cbadge', '-'));
      else if (p.communities.length) { var cb = el('span', 'psn-cbadge has', p.communities.length + ' ชุมชน'); cb.title = p.communities.join(', '); c4.appendChild(cb); }
      else c4.appendChild(el('span', 'psn-cbadge', 'ยังไม่กำหนด'));
      td('ตำแหน่ง').textContent = p.position || '-';
      var c6 = td('ระดับสิทธิ์'); if (p.role) c6.appendChild(el('span', 'psn-badge', p.role)); else c6.appendChild(el('span', 'psn-sub', 'ไม่มีบัญชี'));
      var c7 = td('สถานะ');
      var closed = p.recordStatus === 'inactive', accOff = p.linked && p.accountStatus !== 'active';
      c7.appendChild(el('span', 'psn-badge ' + (closed || accOff ? 'off' : 'on'), closed ? 'ปิดสถานะ' : (p.linked ? p.accountStatus : 'active')));
      td('แจ้งเตือน').textContent = [p.notifyAssignment ? 'มอบหมาย' : '', p.notifyReferral ? 'ส่งต่อ' : ''].filter(Boolean).join(' ') || '-';
      var c9 = td('จัดการ'), a = el('div', 'psn-rowact');
      a.appendChild(btn('ดูงาน', 'sm', function () { openTasks(p); }));
      a.appendChild(btn(S.ov.perm.canEdit ? 'ดู/แก้' : 'ดู', 'sm edit', function () { editRow(p.id); }));
      if (S.ov.perm.canDelete) a.appendChild(btn(closed ? 'เปิดสถานะ' : 'ปิดสถานะ', 'sm ' + (closed ? 'ok' : 'danger'), function () { openDeactivate(p, closed); }));
      c9.appendChild(a);
      tb.appendChild(tr);
    });
    var pg = $('psn-pager'); pg.textContent = '';
    pg.appendChild(el('span', 'info', 'ทั้งหมด ' + Number(r.total).toLocaleString('th-TH') + ' รายการ · หน้า ' + r.page + '/' + r.totalPages));
    if (r.totalPages > 1) {
      var prev = btn('‹ ก่อนหน้า', 'sm', function () { S.page = r.page - 1; search(); }); prev.disabled = r.page <= 1; pg.appendChild(prev);
      var next = btn('ถัดไป ›', 'sm', function () { S.page = r.page + 1; search(); }); next.disabled = r.page >= r.totalPages; pg.appendChild(next);
    }
  }

  // ---------------------------------------------------------------------
  // หน้าต่าง (สร้างใหม่ทุกครั้ง · ปิดด้วย Esc / ปุ่ม / คลิกพื้นหลัง)
  // ---------------------------------------------------------------------
  function modal(title, size) {
    var m = el('div', 'psn-m'), d = el('div', 'psn-dlg' + (size ? ' ' + size : ''));
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.tabIndex = -1;
    var h = el('div', 'psn-mh'), t = el('div', 'psn-mt', title); t.id = 'psn-mt-' + Date.now(); d.setAttribute('aria-labelledby', t.id);
    var body = el('div', 'psn-mb'), foot = el('div', 'psn-mf');
    var x = { m: m, d: d, body: body, foot: foot, title: t, close: close };
    h.appendChild(t); h.appendChild(btn('ปิด', '', close));
    d.appendChild(h); d.appendChild(body); d.appendChild(foot); m.appendChild(d);
    var prevFocus = document.activeElement;
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { document.removeEventListener('keydown', onKey); m.remove(); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} }
    m.addEventListener('mousedown', function (e) { if (e.target === m) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(m);
    setTimeout(function () { d.focus(); }, 0);
    return x;
  }

  // ---------------------------------------------------------------------
  // ฟอร์มเพิ่ม/แก้ (5 ส่วนตามเดิม)
  // ---------------------------------------------------------------------
  function editRow(id) {
    P.loading(true);
    call('personnel.get', { id: id }).then(function (r) {
      P.loading(false);
      if (!guard(r)) return;
      if (!r.ok) { P.toast(r.message || 'โหลดข้อมูลบุคลากรไม่สำเร็จ', 'err'); return; }
      openForm(r.record);
    });
  }
  function openForm(rec) {
    var ov = S.ov, L = ov.lists, isNew = !rec, canWrite = isNew ? ov.perm.canAdd : ov.perm.canEdit;
    rec = rec || { groups: [], communities: [], notifyAssignment: true, notifyReferral: true, primaryNotifyChannel: 'Gateway',
      personnelType: 'บุคลากรภายใน', workStatus: 'ปฏิบัติงาน', role: 'staff', accountStatus: 'active' };
    S.rec = rec;
    var x = modal(isNew ? 'เพิ่มบุคลากร' : (canWrite ? 'แก้ไขบุคลากร' : 'ข้อมูลบุคลากร'));
    var F = {};

    // 1) บัญชีผู้ใช้และสิทธิ์
    var s1 = section('🔐', 'บัญชีผู้ใช้และสิทธิ์เข้าใช้งาน'), g1 = el('div', 'psn-grid');
    F.create = sel('pf-create', [{ value: 'false', text: 'บันทึกเฉพาะทะเบียนบุคลากร' }, { value: 'true', text: 'สร้างบัญชีผู้ใช้ใหม่' }]);
    F.create.disabled = !isNew || !ov.isSuper;
    F.username = inp('pf-username', 'ชื่อผู้ใช้'); F.username.value = rec.username || ''; F.username.autocomplete = 'off';
    F.username.disabled = !isNew;
    var pwNote = inp('pf-pwnote'); pwNote.disabled = true;
    pwNote.value = isNew ? 'ระบบออกรหัสชั่วคราวให้หลังบันทึก' : (rec.linked ? 'จัดการรหัสผ่านที่หน้าผู้ใช้' : '-');
    F.role = sel('pf-role', L.roles.map(function (r) { return { value: r.key, text: r.label || r.key }; }));
    if (rec.role && !L.roles.some(function (r) { return r.key === rec.role; })) opt(F.role, rec.role);
    F.role.value = rec.role || 'staff';
    var link = inp('pf-link'); link.disabled = true;
    link.value = isNew ? 'สร้างอัตโนมัติ' : (rec.linked ? 'ผูกบัญชีแล้ว · ' + rec.id : 'ยังไม่ผูกบัญชีผู้ใช้ · ' + rec.id);
    F.acc = sel('pf-acc', [{ value: 'active', text: 'ใช้งาน' }, { value: 'inactive', text: 'ปิดใช้งาน' }]); F.acc.value = rec.accountStatus === 'inactive' ? 'inactive' : 'active';
    g1.appendChild(field('สร้างบัญชีผู้ใช้', F.create)); g1.appendChild(field('ชื่อผู้ใช้', F.username)); g1.appendChild(field('รหัสผ่านเริ่มต้น', pwNote));
    g1.appendChild(field('ระดับสิทธิ์', F.role)); g1.appendChild(field('รหัสบุคลากร / บัญชี', link)); g1.appendChild(field('สถานะบัญชี', F.acc));
    s1.appendChild(g1);
    s1.appendChild(el('div', 'psn-info', 'บัญชีผู้ใช้และระดับสิทธิ์อ้างอิงจากระบบกลาง · ชื่อ ตำแหน่ง และกลุ่มงาน แก้ที่นี่หรือหน้าผู้ใช้ก็ได้ ข้อมูลจะตรงกันเสมอ'));
    function accState() {
      var hasAcc = isNew ? F.create.value === 'true' : rec.linked;
      F.username.disabled = !(isNew && F.create.value === 'true');
      F.role.disabled = !canWrite || !hasAcc; F.acc.disabled = !canWrite || !hasAcc;
    }
    F.create.addEventListener('change', accState);
    x.body.appendChild(s1);

    // 2) ข้อมูลบุคลากร
    var s2 = section('👤', 'ข้อมูลบุคลากร'), g2 = el('div', 'psn-grid');
    F.prefix = sel('pf-prefix', L.prefixes, '-');
    if (rec.prefix && L.prefixes.indexOf(rec.prefix) < 0) opt(F.prefix, rec.prefix);
    F.prefix.value = rec.prefix || (isNew ? 'นาย' : '');
    F.first = inp('pf-first', 'ชื่อ'); F.first.value = rec.firstName || '';
    F.last = inp('pf-last', 'นามสกุล'); F.last.value = rec.lastName || '';
    F.phone = inp('pf-phone', 'เบอร์โทรติดต่อ', 'tel'); F.phone.value = rec.phone || ''; F.phone.inputMode = 'tel'; F.phone.autocomplete = 'off';
    F.email = inp('pf-email', 'อีเมล', 'email'); F.email.value = rec.email || ''; F.email.inputMode = 'email';
    F.line = inp('pf-line', 'LINE ID'); F.line.value = rec.lineId || '';
    [['คำนำหน้า', F.prefix], ['ชื่อ', F.first], ['นามสกุล', F.last], ['เบอร์โทร', F.phone], ['อีเมล', F.email], ['LINE ID', F.line]]
      .forEach(function (a) { g2.appendChild(field(a[0], a[1])); });
    s2.appendChild(g2);
    if (rec.cidMasked) s2.appendChild(el('div', 'psn-info', 'เลขบัตรประชาชน (จากข้อมูลเดิม): ' + rec.cidMasked));
    x.body.appendChild(s2);

    // 3) กลุ่มงาน ตำแหน่ง สถานะ
    var s3 = section('🏢', 'กลุ่มงาน ตำแหน่ง และสถานะการทำงาน'), g3 = el('div', 'psn-grid');
    var wg = el('div', 'psn-wg'), bar = el('div', 'psn-wgbar');
    bar.appendChild(el('span', null, 'เลือกกลุ่มงานที่เกี่ยวข้อง'));
    var clr = btn('ล้างค่า', 'mini', function () { F.wgOrder = []; Array.prototype.forEach.call(wg.querySelectorAll('input'), function (i) { i.checked = false; }); chips(); });
    bar.appendChild(clr); wg.appendChild(bar);
    var boxes = el('div', 'psn-wgboxes'), buckets = {};
    L.workGroups.forEach(function (g) { var c = WG_CAT[g.key] || 'อื่น ๆ'; (buckets[c] = buckets[c] || []).push(g); });
    F.wgOrder = (rec.groups || []).slice();
    WG_ORDER.concat(Object.keys(buckets).filter(function (c) { return WG_ORDER.indexOf(c) < 0; })).forEach(function (c) {
      if (!buckets[c]) return;
      var b = el('div', 'psn-gbox'); b.appendChild(el('div', 'psn-gboxh', c));
      var o = el('div', 'psn-gopts');
      buckets[c].forEach(function (g) {
        var lab = el('label', 'psn-opt'), cb = el('input'); cb.type = 'checkbox'; cb.value = g.key; cb.checked = F.wgOrder.indexOf(g.key) >= 0;
        cb.addEventListener('change', function () {
          var i = F.wgOrder.indexOf(g.key);
          if (cb.checked && i < 0) F.wgOrder.push(g.key); if (!cb.checked && i >= 0) F.wgOrder.splice(i, 1);
          chips(); commState();
        });
        lab.appendChild(cb); lab.appendChild(el('span', null, g.label)); o.appendChild(lab);
      });
      b.appendChild(o); boxes.appendChild(b);
    });
    wg.appendChild(boxes);
    var ch = el('div', 'psn-chips'); wg.appendChild(ch);
    function chips() {
      ch.textContent = '';
      if (!F.wgOrder.length) { ch.appendChild(el('span', 'psn-chip muted', 'ยังไม่ได้เลือกกลุ่มงาน')); return; }
      F.wgOrder.forEach(function (k, i) { ch.appendChild(el('span', 'psn-chip', (i === 0 ? 'หลัก: ' : '') + groupLabel(k))); });
    }
    chips();
    var disc = el('details', 'psn-disc'); disc.appendChild(el('summary', null, 'หลักการกำหนดกลุ่มงานหลัก'));
    disc.appendChild(el('div', null, 'กลุ่มแรกที่เลือกจะเป็นกลุ่มงานหลัก และระบบจะบันทึกกลุ่มงานที่เลือกทั้งหมด')); wg.appendChild(disc);
    g3.appendChild(field('กลุ่มงาน', wg, 'full'));
    F.position = sel('pf-position', [], 'เลือกตำแหน่ง');
    (L.positionGroups || []).forEach(function (pg) {
      var og = el('optgroup'); og.label = pg.label;
      pg.items.forEach(function (it) { opt(og, it); }); F.position.appendChild(og);
    });
    if (rec.position && (L.positions || []).indexOf(rec.position) < 0) opt(F.position, rec.position, rec.position + ' (จากข้อมูลเดิม)');
    F.position.value = rec.position || '';
    F.ptype = sel('pf-ptype', L.personnelTypes); F.ptype.value = rec.personnelType || 'บุคลากรภายใน';
    F.wstatus = sel('pf-wstatus', L.workStatus); F.wstatus.value = rec.workStatus || 'ปฏิบัติงาน';
    g3.appendChild(field('ตำแหน่ง', F.position)); g3.appendChild(field('ประเภทบุคลากร', F.ptype)); g3.appendChild(field('สถานะการทำงาน', F.wstatus));
    s3.appendChild(g3); x.body.appendChild(s3);

    // 4) ชุมชนที่รับผิดชอบ (เฉพาะกลุ่มงานเยี่ยมบ้าน)
    var s4 = section('🏘️', 'ชุมชนที่รับผิดชอบ'); s4.id = 'pf-comm-sec';
    var cc = el('div', 'psn-cc'), cbar = el('div', 'psn-ccbar');
    var ct = el('b', null, 'ฐานชุมชนเขตสวนหลวง'); ct.style.color = '#166534'; cbar.appendChild(ct);
    var cacts = el('div', 'psn-actions');
    var cclr = btn('ล้างชุมชน', 'mini', function () { Array.prototype.forEach.call(cg.querySelectorAll('input'), function (i) { i.checked = false; }); csum(); });
    var cnew = btn('+ เพิ่มชุมชน', 'mini', function () { openCommEditor(null); });
    cacts.appendChild(cclr); if (ov.scope === 'all' && ov.perm.canEdit) cacts.appendChild(cnew);
    cbar.appendChild(cacts); cc.appendChild(cbar);
    var ced = el('div', 'psn-cedit'); ced.hidden = true; cc.appendChild(ced);
    var cg = el('div', 'psn-cgrid'); cc.appendChild(cg);
    var cs = el('div', 'psn-csum'); cc.appendChild(cs);
    var selected = {}; (rec.communities || []).forEach(function (c) { selected[c.key] = true; });
    function renderComms() {
      var keep = {}; Array.prototype.forEach.call(cg.querySelectorAll('input:checked'), function (i) { keep[i.value] = true; });
      if (cg.childNodes.length) selected = keep;
      cg.textContent = '';
      var list = L.communities.filter(function (c) { return c.status === 'active' || selected[c.key]; });
      if (!list.length) { cg.appendChild(el('div', 'psn-msg', 'ยังไม่มีฐานข้อมูลชุมชน')); }
      list.forEach(function (c) {
        var box = el('div', 'psn-copt'), lab = el('label'), cb = el('input');
        cb.type = 'checkbox'; cb.value = c.key; cb.checked = !!selected[c.key]; cb.disabled = !canWrite;
        cb.addEventListener('change', csum);
        var tx = el('span'); tx.appendChild(el('b', null, c.name)); tx.appendChild(el('br'));
        tx.appendChild(el('small', null, 'แขวง ' + c.subDistrict + ' · ' + c.type + (c.status !== 'active' ? ' · ' + (c.status === 'draft' ? 'ฉบับร่าง' : 'ไม่ใช้งาน') : '')));
        if (c.areaNote) { tx.appendChild(el('br')); tx.appendChild(el('small', null, 'ที่ตั้ง: ' + c.areaNote)); }
        lab.appendChild(cb); lab.appendChild(tx); box.appendChild(lab);
        if (ov.scope === 'all' && ov.perm.canEdit) box.appendChild(btn('แก้รายละเอียด', 'mini', function () { openCommEditor(c); }));
        cg.appendChild(box);
      });
      csum();
    }
    function csum() {
      var n = cg.querySelectorAll('input:checked').length;
      cs.textContent = n ? 'เลือกแล้ว ' + n + ' ชุมชน' : 'ยังไม่ได้เลือกชุมชน';
    }
    var first = (rec.communities || [])[0] || {};
    var cg2 = el('div', 'psn-grid'); cg2.style.marginTop = '12px';
    F.crole = sel('pf-crole', L.communityRoles); F.crole.value = first.role || 'ผู้รับผิดชอบหลัก';
    F.cnote = inp('pf-cnote', 'หมายเหตุการรับผิดชอบชุมชน'); F.cnote.value = first.note || '';
    cg2.appendChild(field('บทบาทในชุมชน', F.crole)); cg2.appendChild(field('หมายเหตุชุมชน', F.cnote, 'half'));
    cc.appendChild(cg2);
    var cdisc = el('details', 'psn-disc'); cdisc.appendChild(el('summary', null, 'เงื่อนไขการรับผิดชอบชุมชน'));
    cdisc.appendChild(el('div', null, 'บุคลากรหนึ่งคนสามารถรับผิดชอบได้หลายชุมชน โดยผู้ดูแลระบบเป็นผู้กำหนดหรือแก้ไข · ระบบเยี่ยมบ้านและ NCD ใช้ข้อมูลนี้'));
    cc.appendChild(cdisc);
    s4.appendChild(cc); x.body.appendChild(s4);
    function commState() { s4.hidden = F.wgOrder.indexOf(HOMECARE) < 0; }
    function openCommEditor(c) {
      ced.hidden = false; ced.textContent = '';
      var hdr = el('div', 'psn-ccbar'); hdr.appendChild(el('b', null, c ? 'แก้รายละเอียดชุมชน ' + c.name : 'เพิ่มชุมชนใหม่'));
      hdr.appendChild(btn('ปิด', 'mini', function () { ced.hidden = true; })); ced.appendChild(hdr);
      var g = el('div', 'psn-grid');
      var nm = inp('ce-name', 'ชื่อชุมชน'); nm.value = c ? c.name : '';
      var sd = sel('ce-sub', L.subDistricts); sd.value = c ? c.subDistrict : 'รอระบุ';
      var ty = sel('ce-type', L.communityTypes); ty.value = c ? c.type : 'รอระบุ';
      var stt = sel('ce-status', [{ value: 'active', text: 'ใช้งาน' }, { value: 'inactive', text: 'ไม่ใช้งาน' }, { value: 'draft', text: 'ฉบับร่าง' }]); stt.value = c ? c.status : 'active';
      var an = inp('ce-note', 'เช่น ซอย / ถนน / จุดสังเกต'); an.value = c ? c.areaNote : '';
      g.appendChild(field('ชื่อชุมชน', nm)); g.appendChild(field('แขวง', sd)); g.appendChild(field('ประเภทชุมชน', ty));
      g.appendChild(field('สถานะชุมชน', stt)); g.appendChild(field('ที่ตั้งโดยย่อ / หมายเหตุพื้นที่', an, 'half'));
      ced.appendChild(g);
      var sv = btn('บันทึกรายละเอียดชุมชน', 'pri', function () {
        sv.disabled = true;
        call('community.save', { community: { key: c ? c.key : '', name: nm.value, subDistrict: sd.value, type: ty.value, status: stt.value, areaNote: an.value } })
          .then(function (r) {
            sv.disabled = false;
            if (!guard(r)) return;
            if (!r.ok) { P.toast(r.message, 'err'); return; }
            var i = L.communities.findIndex(function (z) { return z.key === r.community.key; });
            if (i >= 0) L.communities[i] = r.community; else { L.communities.push(r.community); L.communities.sort(function (a, b) { return a.name.localeCompare(b.name, 'th'); }); }
            ced.hidden = true; renderComms(); P.toast(r.message);
          });
      });
      sv.style.marginTop = '10px'; ced.appendChild(sv);
      nm.focus();
    }
    renderComms(); commState();

    // 5) การแจ้งเตือนและหมายเหตุ
    var s5 = section('🔔', 'การแจ้งเตือนและหมายเหตุ'), g5 = el('div', 'psn-grid');
    var yn = [{ value: 'true', text: 'ใช่' }, { value: 'false', text: 'ไม่ใช่' }];
    F.channel = sel('pf-channel', L.notifyChannels); F.channel.value = rec.primaryNotifyChannel || 'Gateway';
    F.nAssign = sel('pf-nassign', yn); F.nAssign.value = String(rec.notifyAssignment !== false);
    F.nRefer = sel('pf-nrefer', yn); F.nRefer.value = String(rec.notifyReferral !== false);
    F.remark = el('textarea', 'psn-ta'); F.remark.id = 'pf-remark'; F.remark.placeholder = 'บันทึกหมายเหตุเพิ่มเติม'; F.remark.value = rec.remark || '';
    g5.appendChild(field('ช่องทางแจ้งเตือนหลัก', F.channel)); g5.appendChild(field('รับแจ้งเตือนมอบหมายงาน', F.nAssign));
    g5.appendChild(field('รับแจ้งเตือนส่งต่อ', F.nRefer)); g5.appendChild(field('หมายเหตุ', F.remark, 'full'));
    s5.appendChild(g5);
    if (!isNew && rec.updatedAt) s5.appendChild(el('div', 'psn-sub', 'แก้ไขล่าสุด ' + P.fmtTime(rec.updatedAt) + (rec.updatedBy ? ' โดย ' + rec.updatedBy : '')));
    x.body.appendChild(s5);

    if (!canWrite) Array.prototype.forEach.call(x.body.querySelectorAll('input, select, textarea, .psn-wgbar button, .psn-ccbar button'), function (e) { if (e.tagName !== 'DETAILS') e.disabled = true; });
    else accState();

    // ปุ่มล่าง
    x.foot.appendChild(btn('ยกเลิก', '', x.close));
    if (canWrite) {
      var save = btn('บันทึก', 'pri', function () { doSave(); }); save.id = 'pf-save'; x.foot.appendChild(save);
    }
    function doSave() {
      if (S.saving) return;
      if (!F.first.value.trim() || !F.last.value.trim()) { P.toast('กรุณาระบุชื่อและนามสกุล', 'err'); (F.first.value.trim() ? F.last : F.first).focus(); return; }
      if (isNew && F.create.value === 'true' && !F.username.value.trim()) { P.toast('กรุณาระบุชื่อผู้ใช้ก่อนสร้างบัญชี', 'err'); F.username.focus(); return; }
      var hasAcc = isNew ? F.create.value === 'true' : rec.linked;
      var data = {
        id: isNew ? '' : rec.id, prefix: F.prefix.value, firstName: F.first.value, lastName: F.last.value,
        phone: F.phone.value, lineId: F.line.value, position: F.position.value, personnelType: F.ptype.value, workStatus: F.wstatus.value,
        groups: F.wgOrder.slice(), primaryNotifyChannel: F.channel.value, notifyAssignment: F.nAssign.value === 'true',
        notifyReferral: F.nRefer.value === 'true', remark: F.remark.value
      };
      if (hasAcc) { data.role = F.role.value; data.accountStatus = F.acc.value; data.email = F.email.value; }
      if (isNew && F.create.value === 'true') { data.createAccount = true; data.username = F.username.value.trim(); }
      if (F.wgOrder.indexOf(HOMECARE) >= 0) {
        data.communities = Array.prototype.map.call(cg.querySelectorAll('input:checked'), function (i, n) {
          return { key: i.value, role: F.crole.value, isPrimary: n === 0, note: F.cnote.value };
        });
      }
      S.saving = true; save.disabled = true; save.textContent = 'กำลังบันทึก…';
      call('personnel.save', { record: data }).then(function (r) {
        S.saving = false; save.disabled = false; save.textContent = 'บันทึก';
        if (!guard(r)) return;
        if (!r.ok) { P.toast(r.message || 'บันทึกไม่สำเร็จ', 'err'); return; }
        x.close();
        P.toast(r.message);
        if (r.tempPassword) showTemp(r.tempPassword);
        loadOverview(); search();
      }, function () { S.saving = false; save.disabled = false; save.textContent = 'บันทึก'; P.toast('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่', 'err'); });
    }
    setTimeout(function () { (isNew ? F.first : (canWrite ? F.first : x.d)).focus(); }, 30);
  }

  function showTemp(t) {
    var x = modal('รหัสผ่านชั่วคราวของบัญชีใหม่', 'narrow');
    var b = el('div', 'psn-pw');
    b.appendChild(el('div', null, 'ชื่อผู้ใช้: ' + t.username));
    b.appendChild(el('div', null, 'รหัสชั่วคราว:'));
    b.appendChild(el('code', null, t.password));
    b.appendChild(el('div', 'psn-sub', 'ใช้ได้ถึง ' + P.fmtTime(t.expiresAt) + ' · เข้าครั้งแรกระบบจะให้ตั้งรหัสใหม่ · แสดงครั้งเดียว'));
    x.body.appendChild(b);
    x.foot.appendChild(btn('คัดลอก', '', function () {
      try { navigator.clipboard.writeText(t.username + ' / ' + t.password); P.toast('คัดลอกแล้ว'); } catch (e) {}
    }));
    x.foot.appendChild(btn('ปิด', 'pri', x.close));
  }

  // ---------------------------------------------------------------------
  // ปิด/เปิดสถานะ
  // ---------------------------------------------------------------------
  function openDeactivate(p, reopen) {
    var x = modal(reopen ? 'เปิดสถานะบุคลากร' : 'ยืนยันปิดสถานะบุคลากร', 'narrow');
    x.body.appendChild(el('p', null, (reopen ? 'เปิดสถานะ ' : 'ปิดสถานะ ') + p.fullName + ' (' + p.id + ')'));
    var reason = null;
    if (!reopen) {
      reason = el('textarea', 'psn-ta'); reason.id = 'pd-reason'; reason.placeholder = 'เหตุผล เช่น ย้าย / ลาออก / เกษียณ';
      x.body.appendChild(field('เหตุผล', reason));
      x.body.appendChild(el('div', 'psn-info', 'ปิดสถานะในทะเบียนเท่านั้น ไม่ลบข้อมูล และไม่ปิดบัญชีผู้ใช้ (ปิดบัญชีได้ที่หน้าผู้ใช้)'));
    }
    x.foot.appendChild(btn('ยกเลิก', '', x.close));
    var go = btn(reopen ? 'เปิดสถานะ' : 'ปิดสถานะ', reopen ? 'pri' : 'danger', function () {
      go.disabled = true;
      call('personnel.deactivate', { id: p.id, reason: reason ? reason.value : '', reopen: !!reopen }).then(function (r) {
        go.disabled = false;
        if (!guard(r)) return;
        if (!r.ok) { P.toast(r.message, 'err'); return; }
        x.close(); P.toast(r.message); loadOverview(); search();
      });
    });
    x.foot.appendChild(go);
  }

  // ---------------------------------------------------------------------
  // ดูงาน (งานบุคคลของระบบใหม่)
  // ---------------------------------------------------------------------
  var MY_ST = { assigned: 'รอรับงาน', accepted: 'รับงานแล้ว', in_progress: 'กำลังทำ', submitted: 'รอตรวจรับ', returned: 'ส่งกลับแก้ไข',
    approved: 'เสร็จแล้ว', rejected: 'ปฏิเสธ', cancelled: 'ยกเลิก' };
  var PRI = { normal: 'ปกติ', urgent: 'ด่วน', very_urgent: 'ด่วนมาก' };
  function openTasks(p) {
    var x = modal('งานที่เกี่ยวข้องกับ ' + p.fullName, 'mid');
    x.body.appendChild(el('div', 'psn-msg', 'กำลังโหลดงาน…'));
    x.foot.appendChild(btn('ปิด', 'pri', x.close));
    call('personnel.tasks', { id: p.id }).then(function (r) {
      x.body.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) { x.body.appendChild(el('div', 'psn-msg', r.message)); return; }
      if (!r.linked) { x.body.appendChild(el('div', 'psn-msg', 'บุคลากรนี้ยังไม่มีบัญชีผู้ใช้ จึงยังรับงานในระบบไม่ได้')); return; }
      var sm = el('div', 'psn-tsum'), s = r.summary;
      [['งานทั้งหมด', s.total], ['รอดำเนินการ', s.pending], ['เกินกำหนด', s.overdue], ['รอตรวจรับ', s.waiting], ['เสร็จแล้ว', s.done]].forEach(function (a) {
        sm.appendChild(el('span', 'psn-chip' + (a[0] === 'เกินกำหนด' && a[1] ? '' : ' muted'), a[0] + ' ' + a[1]));
      });
      x.body.appendChild(sm);
      var wrap = el('div', 'psn-panel'), t = el('table', 'psn-table'), th = el('thead'), tr = el('tr');
      ['งาน', 'ความเร่งด่วน', 'กำหนดส่ง', 'สถานะ', 'ความคืบหน้า'].forEach(function (h) { tr.appendChild(el('th', null, h)); });
      th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody'); t.appendChild(tb);
      if (!r.rows.length) { var e = el('tr'), td = el('td', 'empty', 'ยังไม่มีงาน'); td.colSpan = 5; e.appendChild(td); tb.appendChild(e); }
      r.rows.forEach(function (k) {
        var row = el('tr');
        var c1 = el('td'); c1.appendChild(el('b', null, k.title)); if (k.createdBy) c1.appendChild(el('div', 'psn-sub', 'มอบโดย ' + k.createdBy)); row.appendChild(c1);
        row.appendChild(el('td', null, PRI[k.priority] || k.priority));
        var c3 = el('td', null, k.dueAt ? P.fmtTime(k.dueAt) : '-'); if (k.overdue) c3.appendChild(el('div', 'psn-sub', 'เกินกำหนด')); row.appendChild(c3);
        var c4 = el('td'); c4.appendChild(el('span', 'psn-badge' + (k.myStatus === 'approved' ? ' on' : k.overdue ? ' off' : ''), MY_ST[k.myStatus] || k.myStatus)); row.appendChild(c4);
        row.appendChild(el('td', null, (k.progress || 0) + '%'));
        tb.appendChild(row);
      });
      wrap.appendChild(el('div', 'psn-tablewrap')).appendChild(t);
      x.body.appendChild(wrap);
      if (window.PHC37Tasks) x.foot.insertBefore(btn('ไปหน้างานบุคคล', '', function () { x.close(); window.PHC37Tasks.open('todo'); }), x.foot.firstChild);
    });
  }

  window.addEventListener('popstate', function () {
    if (!$('view-personnel').hidden) { Array.prototype.forEach.call(document.querySelectorAll('.psn-m'), function (m) { m.remove(); }); }
  });

  window.PHC37Personnel = { open: open, refresh: function () { loadOverview(); return search(); } };
})();
