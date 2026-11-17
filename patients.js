/* PHC37 PWA — patients.js (PHC37-PWA-PATIENTS-1.0.1) : เวชระเบียนกลาง — ค้นหา · เปิดแฟ้ม (ดูอย่างเดียวช่วงเปลี่ยนผ่าน)
 * ไม่เก็บข้อมูลผู้ป่วยไว้ในเครื่อง (ไม่ใช้แคช localStorage) — เก็บเฉพาะตัวเลขสรุปภาพรวม */
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
  function chip(text, kind) { return el('span', 'chip ' + (kind || ''), text); }
  function call(action, data) { data = data || {}; data.token = P.token(); return P.api(action, data); }
  function openDlg(d) { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }
  function guard(res) {
    if (res && !res.ok && res.code === 'unauthorized') { P.showLogin(res.message); return false; }
    return true;
  }
  var S = { q: '', seq: 0, timer: null, cur: null };

  // ---------- เปิดหน้า ----------
  function open() {
    P.show('view-patients');
    try { history.pushState({ phc37View: 'patients' }, ''); } catch (e) {}
    window.scrollTo(0, 0);
    loadOverview();
    setTimeout(function () { $('pt-q').focus(); }, 50);
  }
  function loadOverview() {
    P.swr('pt.overview', function () { return call('patient.overview'); }, function (r) {
      var box = $('pt-overview'); box.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) {
        $('pt-notice').className = 'alert'; $('pt-notice').textContent = r.message;
        if (r.code === 'forbidden') { $('pt-form').hidden = true; $('pt-list').textContent = ''; }
        return;
      }
      $('pt-form').hidden = false;
      $('pt-notice').className = 'alert info';
      $('pt-notice').textContent = '🔄 ' + r.notice + (r.lastOkText ? ' · ดึงล่าสุด ' + r.lastOkText : ' · ยังไม่เคยดึงข้อมูล');
      if (r.lastRun && r.lastRun.status === 'error') {
        $('pt-notice').className = 'alert warn';
        $('pt-notice').textContent += ' · ⚠️ รอบล่าสุดไม่สำเร็จ (' + (r.lastRun.startedText || '') + ')';
      }
      box.appendChild(chip('ทั้งหมด ' + (r.total || 0) + ' ราย', 'ok'));
      if (r.noBirthDate) box.appendChild(chip('ไม่มีวันเกิด ' + r.noBirthDate, 'warn'));
      if (r.noHN) box.appendChild(chip('ไม่มี HN ' + r.noHN, 'warn'));
      if (r.invalidCID) box.appendChild(chip('เลขบัตรไม่ถูกต้อง ' + r.invalidCID, 'danger'));
      if (r.noMainRight) box.appendChild(chip('ไม่มีสิทธิหลัก ' + r.noMainRight, ''));
      if (r.missingInSource) box.appendChild(chip('ถูกลบจากระบบเดิม ' + r.missingInSource, ''));
    });
  }

  // ---------- ค้นหา ----------
  function search(now) {
    clearTimeout(S.timer);
    var q = $('pt-q').value.trim();
    if (q.length < 2) {
      S.seq++;
      $('pt-count').textContent = '';
      $('pt-list').textContent = '';
      $('pt-list').appendChild(el('p', 'empty', 'พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา'));
      return;
    }
    if (!now) { S.timer = setTimeout(function () { search(true); }, 350); return; }
    var seq = ++S.seq, wrap = $('pt-list');
    P.skeleton(wrap, 3);
    $('pt-count').textContent = '';
    call('patient.search', { keyword: q, limit: 50, level: 'contact', includeInactive: $('pt-inactive').checked }).then(function (r) {
      if (seq !== S.seq) return;
      wrap.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) { wrap.appendChild(el('p', 'empty', r.message)); return; }
      $('pt-count').textContent = 'พบ ' + r.total + ' ราย' + (r.more ? ' (แสดง ' + r.data.length + ' รายแรก — พิมพ์ให้เจาะจงขึ้น)' : '');
      if (!r.data.length) { wrap.appendChild(el('p', 'empty', 'ไม่พบผู้ป่วยที่ตรงกับ "' + q + '"')); return; }
      r.data.forEach(function (p) { wrap.appendChild(row(p)); });
    });
  }
  function row(p) {
    var b = el('button', 'row tk-row pt-row'); b.type = 'button';
    var main = el('span', 'row-main');
    main.appendChild(el('span', 'row-title', p.fullName || '(ไม่มีชื่อ)'));
    var sub = [p.hn ? 'HN ' + p.hn : 'ไม่มี HN', p.cidMasked || 'ไม่มีเลขบัตร', [p.gender, p.ageText ? p.ageText.replace(/ \d+ วัน$/, '') : ''].filter(Boolean).join(' ')]
      .filter(Boolean).join(' · ');
    main.appendChild(el('span', 'row-sub', sub));
    var f = el('span', 'row-flags');
    if (p.mainRight) f.appendChild(chip(p.mainRight + (p.subRight ? ' · ' + p.subRight : ''), 'info'));
    if (p.communityName) f.appendChild(chip(p.communityName, ''));
    if (String(p.status).toLowerCase() === 'inactive' || p.status === 'ปิดใช้งาน') f.appendChild(chip('ปิดใช้งาน', 'danger'));
    (p.linkedSystems || []).slice(0, 4).forEach(function (s) { f.appendChild(chip(s.name, 'ok')); });
    main.appendChild(f);
    b.appendChild(main);
    b.addEventListener('click', function () { openPatient(p.patientID); });
    return b;
  }

  // ---------- แฟ้มผู้ป่วย ----------
  function field(dl, label, value) {
    if (value === undefined || value === null || value === '') value = '—';
    var w = el('div', 'pt-f');
    w.appendChild(el('dt', null, label));
    var dd = el('dd'); if (typeof value === 'string') dd.textContent = value; else dd.appendChild(value);
    w.appendChild(dd); dl.appendChild(w);
    return dd;
  }
  function section(body, title) {
    var s = el('div', 'tk-sec'); s.appendChild(el('h3', null, title));
    var dl = el('dl', 'pt-grid'); s.appendChild(dl); body.appendChild(s);
    return dl;
  }
  function openPatient(pid) {
    S.cur = pid;
    $('pt-title').textContent = 'กำลังโหลด...';
    P.skeleton($('pt-body'), 3);
    openDlg($('dlg-patient'));
    call('patient.getById', { patientID: pid, level: 'full' }).then(function (r) {
      if (S.cur !== pid) return;
      if (!guard(r)) return;
      var body = $('pt-body'); body.textContent = '';
      if (!r.ok) { $('pt-title').textContent = 'เปิดแฟ้มไม่ได้'; body.appendChild(el('p', 'empty', r.message)); return; }
      render(r.data);
    });
  }
  function render(p) {
    var body = $('pt-body');
    $('pt-title').textContent = p.fullName || '(ไม่มีชื่อ)';
    var head = el('div', 'row-flags');
    head.appendChild(chip(p.hn ? 'HN ' + p.hn : 'ไม่มี HN', p.hn ? 'ok' : 'warn'));
    if (String(p.status).toLowerCase() === 'inactive' || p.status === 'ปิดใช้งาน') head.appendChild(chip('ปิดใช้งาน', 'danger'));
    if (p.cidState === 'invalid') head.appendChild(chip('เลขบัตรไม่ถูกต้อง', 'danger'));
    if (!p.hasBirthDate) head.appendChild(chip('ไม่มีวันเกิด', 'warn'));
    body.appendChild(head);
    body.appendChild(el('p', 'muted tk-meta', 'รหัสผู้ป่วย ' + p.patientID + ' · ดูอย่างเดียว (แก้ไขที่ Gateway เดิมช่วงเปลี่ยนผ่าน)'));

    var g = section(body, '👤 ข้อมูลทั่วไป');
    field(g, 'ชื่อ-สกุล', [p.prefix, p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName);
    field(g, 'เพศ', p.gender);
    field(g, 'วันเกิด', p.birthDateBE ? p.birthDateBE + (p.ageText ? ' (อายุ ' + p.ageText + ')' : '') : '');
    var cidBox = el('span', 'pt-cid');
    cidBox.appendChild(el('span', null, p.cidMasked || '—'));
    if (p.cidMasked) {
      var rb = el('button', 'btn btn-ghost btn-sm', '👁️ แสดงเลขบัตร'); rb.type = 'button';
      rb.title = 'ระบบจะบันทึกประวัติการดูเลขบัตร';
      rb.addEventListener('click', function () {
        P.busy(rb, true, 'กำลังโหลด...');
        call('patient.revealCID', { patientID: p.patientID }).then(function (x) {
          P.busy(rb, false);
          if (!x.ok) return P.toast(x.message, 'err');
          cidBox.textContent = x.cid.replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, '$1-$2-$3-$4-$5');
        });
      });
      cidBox.appendChild(rb);
    }
    field(g, 'เลขบัตรประชาชน', cidBox);
    field(g, 'สถานภาพ', p.maritalStatus);
    field(g, 'การศึกษา', p.educationLevel);
    field(g, 'อาชีพ', p.occupation);

    var rt = section(body, '🏥 สิทธิการรักษา');
    field(rt, 'สิทธิหลัก', p.mainRight);
    field(rt, 'สิทธิย่อย', p.subRight);

    var ad = section(body, '🏠 ที่อยู่');
    field(ad, 'ที่อยู่', p.addressText);
    field(ad, 'ชุมชน', p.communityName);

    var ct = section(body, '📞 เบอร์โทร / ผู้ติดต่อ');
    var phones = p.phones || [];
    if (phones.length) {
      var ul = el('div', 'pt-phones');
      phones.forEach(function (x) {
        var a = el('a', 'file-chip pt-phone', (x.primary ? '⭐ ' : '📞 ') + x.phone + ' · ' + x.owner + (x.name ? ' (' + x.name + ')' : ''));
        a.href = 'tel:' + String(x.phone).replace(/[^\d+]/g, '');
        ul.appendChild(a);
      });
      field(ct, 'เบอร์โทร', ul);
    } else field(ct, 'เบอร์โทร', p.phone);
    (p.contacts || []).filter(function (c) { return c.role !== 'SELF'; }).forEach(function (c) {
      field(ct, c.roleTH + (c.relation ? ' (' + c.relation + ')' : ''), [c.name, c.cidMasked ? 'เลขบัตร ' + c.cidMasked : '', c.note].filter(Boolean).join(' · '));
    });

    if (p.note) { var nt = section(body, '📝 หมายเหตุ'); field(nt, 'หมายเหตุ', p.note); }

    var ls = el('div', 'tk-sec'); ls.appendChild(el('h3', null, '🔗 ใช้ในระบบ'));
    if ((p.linkedSystems || []).length) {
      var w = el('div', 'row-flags');
      p.linkedSystems.forEach(function (s) { w.appendChild(chip(s.name + ' · ล่าสุด ' + (s.last || '-') + (s.days ? ' · ' + s.days + ' วัน' : ''), 'ok')); });
      ls.appendChild(w);
    } else ls.appendChild(el('p', 'muted', 'ยังไม่มีข้อมูลการใช้ในระบบอื่น'));
    body.appendChild(ls);

    var mt = section(body, '🕘 ประวัติข้อมูล');
    field(mt, 'สร้าง', [p.createdAt, p.createdBy].filter(Boolean).join(' · '));
    field(mt, 'แก้ไขล่าสุด', [p.updatedAt, p.updatedBy].filter(Boolean).join(' · '));
    if (p.lastVisitAt) field(mt, 'มารับบริการล่าสุด', p.lastVisitAt);
  }

  // ---------- เหตุการณ์ ----------
  $('pt-form').addEventListener('submit', function (e) { e.preventDefault(); search(true); });
  $('pt-q').addEventListener('input', function () { search(false); });
  $('pt-inactive').addEventListener('change', function () { if ($('pt-q').value.trim().length >= 2) search(true); });
  $('pt-close').addEventListener('click', function () { $('dlg-patient').close(); });
  $('dlg-patient').addEventListener('close', function () { S.cur = null; $('pt-body').textContent = ''; });
  $('pt-back').addEventListener('click', function () {
    if (history.state && history.state.phc37View === 'patients') { history.back(); return; }
    leave();
  });
  window.addEventListener('popstate', function () {
    if (!$('view-patients').hidden && !(history.state && history.state.phc37View === 'patients')) leave();
  });
  function leave() {
    S.seq++;
    $('pt-q').value = ''; $('pt-list').textContent = ''; $('pt-count').textContent = '';
    $('pt-list').appendChild(el('p', 'empty', 'พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา'));
    P.goHome();
  }

  window.PHC37Patients = { open: open, openPatient: openPatient };
})();
