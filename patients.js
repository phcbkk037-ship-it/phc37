/* PHC37 PWA — patients.js (PHC37-PWA-PATIENTS-1.1.0) : เวชระเบียนกลาง — หน้าตาแบบ Gateway เดิม
 * การ์ดสรุป 4 ใบ · ค้นหา · ตาราง 11 คอลัมน์ (ดู / แก้ไข) · แฟ้มใต้ตาราง · เพิ่ม/แก้ด้วยฟอร์ม Patient Kit (patient-form.js)
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
  function st(text, kind) { return el('span', 'gw-st ' + (kind || 'off'), text); }
  function call(action, data) { data = data || {}; data.token = P.token(); return P.api(action, data); }
  function guard(res) {
    if (res && !res.ok && res.code === 'unauthorized') { P.showLogin(res.message); return false; }
    return true;
  }
  function inactive(p) { var s = String(p.status || '').toLowerCase(); return s === 'inactive' || s === 'ปิดใช้งาน'; }
  var S = { seq: 0, timer: null, cur: null, ov: null, lastQ: '' };
  var EMPTY = 'พิมพ์คำค้นหาแล้วกดค้นหา เพื่อแสดงรายการผู้ป่วย';

  // ---------- เปิดหน้า ----------
  function open() {
    P.show('view-patients');
    P.setPage('patients', 'เวชระเบียนกลาง');
    try { history.pushState({ phc37View: 'patients' }, ''); } catch (e) {}
    window.scrollTo(0, 0);
    loadOverview();
    setTimeout(function () { $('pt-q').focus(); }, 50);
  }

  function sumCard(cls, label, value, foot) {
    var c = el('div', 'gw-sumc ' + cls);
    c.appendChild(el('div', 'l', label));
    c.appendChild(el('div', 'v', value === null || value === undefined ? '-' : Number(value).toLocaleString('th-TH')));
    c.appendChild(el('div', 'f', foot));
    return c;
  }
  function loadOverview(fresh) {
    P.swr('pt.overview', function () { return call('patient.overview'); }, function (r) {
      var box = $('pt-overview'), q = $('pt-quality'), nt = $('pt-notice');
      box.textContent = ''; q.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) {
        nt.hidden = false; nt.textContent = r.message;
        if (r.code === 'forbidden') { $('pt-form').hidden = true; P.tableMsg($('pt-list'), r.message); }
        return;
      }
      S.ov = r;
      $('pt-form').hidden = false;
      $('pt-add').hidden = !r.canAdd;
      box.appendChild(sumCard('total', 'ผู้ป่วยทั้งหมด', r.total, 'ทุกสถานะ'));
      box.appendChild(sumCard('success', 'ใช้งาน', r.active, 'พร้อมใช้งาน'));
      box.appendChild(sumCard('fail', 'ปิดใช้งาน', r.inactive, 'ปิดการใช้งาน'));
      box.appendChild(sumCard('user', 'เพิ่มวันนี้', r.today, 'บันทึกใหม่วันนี้'));
      if (r.noBirthDate) q.appendChild(st('ไม่มีวันเกิด ' + r.noBirthDate, 'warn'));
      if (r.noHN) q.appendChild(st('ไม่มี HN ' + r.noHN, 'warn'));
      if (r.invalidCID) q.appendChild(st('เลขบัตรไม่ถูกต้อง ' + r.invalidCID, 'danger'));
      if (r.noMainRight) q.appendChild(st('ไม่มีสิทธิหลัก ' + r.noMainRight, 'off'));
      nt.hidden = false;
      nt.textContent = '🔄 ' + r.notice + (r.lastOkText ? ' · ดึงล่าสุด ' + r.lastOkText : ' · ยังไม่เคยดึงข้อมูล');
      if (r.lastRun && r.lastRun.status === 'error') nt.textContent += ' · ⚠️ รอบล่าสุดไม่สำเร็จ (' + (r.lastRun.startedText || '') + ')';
      if (S.cur) renderActions();
    }, null, fresh === true);
  }

  // ---------- ค้นหา ----------
  function search(now) {
    clearTimeout(S.timer);
    var q = $('pt-q').value.trim();
    if (q.length < 2) {
      S.seq++; $('pt-count').textContent = '';
      P.tableMsg($('pt-list'), q ? 'พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา' : EMPTY);
      return;
    }
    if (!now) { S.timer = setTimeout(function () { search(true); }, 350); return; }
    S.lastQ = q;
    var seq = ++S.seq, wrap = $('pt-list');
    P.skeleton(wrap, 3);
    $('pt-count').textContent = '';
    call('patient.search', { keyword: q, limit: 50, level: 'full', includeInactive: $('pt-inactive').checked }).then(function (r) {
      if (seq !== S.seq) return;
      wrap.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) { P.tableMsg(wrap, r.message); return; }
      $('pt-count').textContent = 'พบ ' + r.total + ' ราย' + (r.more ? ' (แสดง ' + r.data.length + ' รายแรก — พิมพ์ให้เจาะจงขึ้น)' : '');
      if (!r.data.length) { P.tableMsg(wrap, 'ไม่พบผู้ป่วยที่ตรงกับ "' + q + '"'); return; }
      r.data.forEach(function (p) { wrap.appendChild(row(p)); });
    });
  }
  function row(p) {
    var tr = el('tr', 'click' + (S.cur === p.patientID ? ' on' : '')); tr.dataset.id = p.patientID;
    var id = el('td', 'nowrap'); id.appendChild(el('b', null, p.hn || '-')); id.appendChild(el('span', 'sub', p.patientID)); tr.appendChild(id);
    tr.appendChild(el('td', null, p.fullName || '(ไม่มีชื่อ)'));
    tr.appendChild(el('td', 'nowrap', p.birthDateBE || '-'));
    tr.appendChild(el('td', 'nowrap', p.ageText || '-'));
    tr.appendChild(el('td', 'nowrap', p.cidMasked || '-'));
    tr.appendChild(el('td', 'nowrap', p.phone || '-'));
    tr.appendChild(el('td', null, p.communityName || '-'));
    var rt = el('td', null, p.mainRight || '-'); if (p.subRight) rt.appendChild(el('span', 'sub', p.subRight)); tr.appendChild(rt);
    var s = el('td'); s.appendChild(inactive(p) ? st('ปิดใช้งาน', 'off') : st('ใช้งาน', 'on')); tr.appendChild(s);
    var up = el('td', 'nowrap', p.updatedAt || p.createdAt || '-'); if (p.updatedBy || p.createdBy) up.appendChild(el('span', 'sub', p.updatedBy || p.createdBy)); tr.appendChild(up);
    var act = el('td'), box = el('span', 'acts');
    var v = el('button', 'gw-view', '👁️ ดู'); v.type = 'button';
    v.addEventListener('click', function (e) { e.stopPropagation(); openPatient(p.patientID); });
    box.appendChild(v);
    if (S.ov && S.ov.canEdit) {
      var ed = el('button', 'gw-edit', '✏️ แก้ไข'); ed.type = 'button';
      ed.addEventListener('click', function (e) { e.stopPropagation(); editPatient(p.patientID); });
      box.appendChild(ed);
    }
    act.appendChild(box); tr.appendChild(act);
    tr.addEventListener('click', function () { openPatient(p.patientID); });
    return tr;
  }

  // ---------- แฟ้มผู้ป่วย (ใต้ตาราง แบบหน้าเดิม) ----------
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
    var dl = el('dl', 'pt-dgrid'); s.appendChild(dl); body.appendChild(s);
    return dl;
  }
  function openPatient(pid) {
    S.cur = pid;
    Array.prototype.forEach.call(document.querySelectorAll('#pt-list tr'), function (t) { t.classList.toggle('on', t.dataset.id === pid); });
    var box = $('pt-detail'); box.hidden = false; box.textContent = '';
    var sk = el('div'); box.appendChild(sk); P.skeleton(sk, 4);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    call('patient.getById', { patientID: pid, level: 'full' }).then(function (r) {
      if (S.cur !== pid) return;
      if (!guard(r)) return;
      box.textContent = '';
      if (!r.ok) { box.appendChild(el('p', 'empty', r.message)); return; }
      render(r.data);
    });
  }
  function closeDetail() { S.cur = null; $('pt-detail').hidden = true; $('pt-detail').textContent = '';
    Array.prototype.forEach.call(document.querySelectorAll('#pt-list tr.on'), function (t) { t.classList.remove('on'); }); }
  function renderActions() {
    var a = $('pt-dacts'); if (!a || !S.cur) return;
    a.textContent = '';
    if (S.ov && S.ov.canEdit) {
      var e = el('button', 'gbtn gbtn-orange gbtn-sm', '✏️ แก้ไขข้อมูล'); e.type = 'button';
      e.addEventListener('click', function () { editPatient(S.cur); }); a.appendChild(e);
    }
    var c = el('button', 'gbtn gbtn-sm', '✕ ปิดแฟ้ม'); c.type = 'button'; c.addEventListener('click', closeDetail); a.appendChild(c);
  }
  function render(p) {
    var body = $('pt-detail');
    var head = el('div', 'pt-detail-head');
    var ht = el('div'); ht.appendChild(el('h4', null, '📄 ' + (p.fullName || '(ไม่มีชื่อ)')));
    var fl = el('div', 'pt-qual');
    fl.appendChild(st(p.hn ? 'HN ' + p.hn : 'ไม่มี HN', p.hn ? 'on' : 'warn'));
    fl.appendChild(st('รหัส ' + p.patientID, 'off'));
    if (inactive(p)) fl.appendChild(st('ปิดใช้งาน', 'danger'));
    if (p.cidState === 'invalid') fl.appendChild(st('เลขบัตรไม่ถูกต้อง', 'danger'));
    if (!p.hasBirthDate) fl.appendChild(st('ไม่มีวันเกิด', 'warn'));
    ht.appendChild(fl); head.appendChild(ht);
    head.appendChild(el('div', 'gw-hero-actions')).id = 'pt-dacts';
    body.appendChild(head);
    renderActions();

    var g = section(body, '👤 ข้อมูลทั่วไป');
    field(g, 'ชื่อ-สกุล', [p.prefix, p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName);
    field(g, 'เพศ', p.gender);
    field(g, 'วันเกิด (พ.ศ.)', p.birthDateBE);
    field(g, 'อายุ ณ ปัจจุบัน', p.ageText);
    var cidBox = el('span', 'pt-cid');
    cidBox.appendChild(el('span', null, p.cidMasked || '—'));
    if (p.cidMasked) {
      var rb = el('button', 'gw-view', '👁️ แสดงเลขบัตร'); rb.type = 'button';
      rb.title = 'ระบบจะบันทึกประวัติการดูเลขบัตร';
      rb.addEventListener('click', function () {
        P.busy(rb, true, 'กำลังโหลด...');
        call('patient.revealCID', { patientID: p.patientID }).then(function (x) {
          P.busy(rb, false);
          if (!x.ok) return P.toast(x.message, 'err');
          cidBox.textContent = x.cid.replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, '$1-$2-$3-$4-$5');
        });
      });
      cidBox.appendChild(document.createTextNode(' ')); cidBox.appendChild(rb);
    }
    field(g, 'เลขบัตรประชาชน', cidBox);
    field(g, 'สิทธิหลัก', p.mainRight);
    field(g, 'สิทธิย่อย', p.subRight);
    field(g, 'สถานภาพสมรส', p.maritalStatus);
    field(g, 'ระดับการศึกษา', p.educationLevel);
    field(g, 'อาชีพ', p.occupation);

    var ad = section(body, '🏠 ที่อยู่');
    field(ad, 'ที่อยู่', p.addressText);
    field(ad, 'ชุมชน', p.communityName);

    var ct = section(body, '📞 เบอร์โทร / ผู้ติดต่อ');
    var phones = p.phones || [];
    if (phones.length) {
      var ul = el('div', 'pt-phones');
      phones.forEach(function (x) {
        var a = el('a', 'file-chip pt-phone', (x.primary ? '⭐ ' : '📞 ') + x.phone + ' · ' + (x.owner === 'ตนเอง' ? 'ของผู้ป่วยเอง' : 'ของ' + x.owner) + (x.name ? ' (' + x.name + ')' : ''));
        a.href = 'tel:' + String(x.phone).replace(/[^\d+]/g, '');
        ul.appendChild(a);
      });
      field(ct, 'เบอร์โทร', ul);
    } else field(ct, 'เบอร์โทร', p.phone);
    (p.contacts || []).filter(function (c) { return c.role !== 'SELF'; }).forEach(function (c) {
      field(ct, c.roleTH + (c.relation ? ' (' + c.relation + ')' : ''), [c.name, c.cidMasked ? 'เลขบัตร ' + c.cidMasked : '', c.note].filter(Boolean).join(' · '));
    });

    if (p.note) { var nt = section(body, '📝 หมายเหตุ'); field(nt, 'หมายเหตุ', p.note); }

    var ls = el('div', 'tk-sec'); ls.appendChild(el('h3', null, '🔗 ระบบที่ใช้ข้อมูลนี้'));
    if ((p.linkedSystems || []).length) {
      var w = el('div', 'pt-qual');
      p.linkedSystems.forEach(function (s) { w.appendChild(st(s.name + ' · ล่าสุด ' + (s.last || '-') + (s.days ? ' · ' + s.days + ' วัน' : ''), 'info')); });
      ls.appendChild(w);
    } else ls.appendChild(el('p', 'muted', 'ยังไม่มีข้อมูลการใช้ในระบบอื่น'));
    body.appendChild(ls);

    var mt = section(body, '🕘 ประวัติข้อมูล');
    field(mt, 'สร้าง', [p.createdAt, p.createdBy].filter(Boolean).join(' · '));
    field(mt, 'แก้ไขล่าสุด', [p.updatedAt, p.updatedBy].filter(Boolean).join(' · '));
    if (p.lastVisitAt) field(mt, 'มารับบริการล่าสุด', p.lastVisitAt);
  }

  // ---------- เพิ่ม / แก้ไข (ฟอร์ม Patient Kit) ----------
  function afterSave(res) {
    loadOverview(true);
    if (S.lastQ && $('pt-q').value.trim() === S.lastQ) search(true);
    if (res && res.patientID) openPatient(res.patientID);
  }
  function editPatient(pid) {
    if (!window.PHC37PatientForm) return P.toast('โหลดฟอร์มไม่สำเร็จ กรุณารีเฟรช', 'err');
    window.PHC37PatientForm.open({ patientID: pid, onSaved: afterSave, onPick: openPatient });
  }
  function addPatient() {
    if (!window.PHC37PatientForm) return P.toast('โหลดฟอร์มไม่สำเร็จ กรุณารีเฟรช', 'err');
    window.PHC37PatientForm.open({ onSaved: afterSave, onPick: openPatient });
  }

  // ---------- เหตุการณ์ ----------
  $('pt-form').addEventListener('submit', function (e) { e.preventDefault(); search(true); });
  $('pt-q').addEventListener('input', function () { search(false); });
  $('pt-inactive').addEventListener('change', function () { if ($('pt-q').value.trim().length >= 2) search(true); });
  $('pt-clear').addEventListener('click', function () { $('pt-q').value = ''; search(true); closeDetail(); $('pt-q').focus(); });
  $('pt-refresh').addEventListener('click', function () { loadOverview(true); if ($('pt-q').value.trim().length >= 2) search(true); });
  $('pt-add').addEventListener('click', addPatient);
  $('pt-back').addEventListener('click', function () {
    if (history.state && history.state.phc37View === 'patients') { history.back(); return; }
    leave();
  });
  window.addEventListener('popstate', function () {
    if (!$('view-patients').hidden && !(history.state && history.state.phc37View === 'patients')) leave();
  });
  function leave() {
    S.seq++;
    $('pt-q').value = ''; $('pt-count').textContent = '';
    P.tableMsg($('pt-list'), EMPTY);
    closeDetail();
    if (window.PHC37PatientForm) window.PHC37PatientForm.close();
    P.goHome();
  }

  window.PHC37Patients = { open: open, openPatient: openPatient, edit: editPatient, add: addPatient };
})();
