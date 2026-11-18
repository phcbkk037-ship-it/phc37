/* PHC37 PWA — patient-form.js (PHC37-PWA-PATIENTFORM-1.1.0) : ฟอร์มผู้ป่วยมาตรฐาน = Patient Kit ของเว็บลูก
 * ส่วน PK ด้านล่างคัดลอกจาก PHC37_PatientKit.html (PHC37-PATIENTKIT-1.0.1) ตรงตัว — ช่อง ลำดับ กติกา เหมือนทุกเว็บลูก
 * หน้าต่าง/ปุ่ม/การบันทึก (PHC37PatientForm) เป็นของระบบใหม่: ข้อมูลตั้งต้นจาก patient.formData · บันทึกด้วย patient.save
 * (Edge → Gateway เดิม → ดึงรายนั้นกลับทันที) · ไม่เก็บข้อมูลผู้ป่วยไว้ในเครื่อง */
(function () {
  var st = document.createElement('style');
  st.id = 'phc37-patientkit-css';
  st.textContent = '\n.pk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}\n.pk-grid .pk-full{grid-column:1/-1}\n.pk-grid>*{min-width:0}\n.pk-sub{font-weight:700;font-size:14px;color:var(--phc-ink-2,#334155);border-top:1px dashed var(--phc-border,#e2e8f0);padding-top:8px;margin-top:2px}\n.pk-hint{font-size:12px;color:var(--phc-muted,#64748b);margin-top:4px;min-height:0}\n.pk-hint:empty{display:none}\n.pk-hint.ok{color:#047857}.pk-hint.bad{color:#b42318}\n.pk-seg{display:flex;gap:6px;flex-wrap:wrap}\n.pk-seg button{border:1px solid var(--phc-border,#cbd5e1);background:#fff;border-radius:999px;padding:7px 16px;font:inherit;cursor:pointer}\n.pk-seg button.on{background:var(--phc-primary,#0f766e);border-color:var(--phc-primary,#0f766e);color:#fff}\n.pk-ph-list{display:grid;gap:8px;margin:6px 0 8px}\n.pk-ph{display:grid;grid-template-columns:minmax(130px,1.1fr) minmax(130px,1fr) minmax(130px,1.2fr) auto 40px;gap:8px;align-items:center}\n.pk-ph.pk-self .pk-nm{visibility:hidden}\n.pk-ph .pk-pr{display:flex;align-items:center;gap:4px;font-size:13px;white-space:nowrap}\n.pk-ph .pk-pr input{width:auto;margin:0}\n.pk-x{width:40px;height:40px;border:1px solid var(--phc-border,#cbd5e1);background:#fff;border-radius:10px;cursor:pointer;font-size:16px}\n.pk-dup{border:1px solid #f59e0b;background:#fffbeb;border-radius:12px;padding:12px;margin:10px 0}\n.pk-dup table{width:100%;min-width:0;border-collapse:collapse;font-size:13px}\n.pk-dup td{padding:6px;border-top:1px solid #fde68a;vertical-align:top}\n.pk-note{font-size:12px;color:var(--phc-muted,#64748b)}\n.pk-warn{border:1px solid #f59e0b;background:#fffbeb;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:10px}\n@media(max-width:700px){\n  .pk-grid{grid-template-columns:1fr}\n  .pk-ph{grid-template-columns:1fr 1fr;padding:10px;border:1px solid var(--phc-border,#e2e8f0);border-radius:10px;background:var(--phc-surface-2,#f8fafc)}\n  .pk-ph .pk-nm{grid-column:1/-1}\n  .pk-ph.pk-self .pk-nm{display:none}\n  .pk-ph .pk-x{justify-self:end}\n}\n';
  document.head.appendChild(st);
})();

/* PHC37 Patient Kit (ฝั่งหน้าเว็บ) — ไม่มี regex literal และไม่มีคอมเมนต์แบบทับสองตัว */
window.PK = (function() {
  var VERSION = 'PHC37-PATIENTKIT-1.0.1';
  var L = null;
  var DEF = { prefixes: ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง'], genders: ['ชาย', 'หญิง'], mainRights: [], subRights: [], maritalStatuses: [], educationLevels: [], occupations: [],
    phoneOwners: ['ตนเอง', 'บิดา', 'มารดา', 'บุตร', 'คู่สมรส', 'พี่ / น้อง', 'หลาน', 'ผู้ดูแล', 'อื่น ๆ'] };
  function esc(s) { return String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&#39;'); }
  function el(id) { return document.getElementById(id); }
  function digits(s) { return String(s == null ? '' : s).split('').filter(function(ch) { return ch >= '0' && ch <= '9'; }).join(''); }
  function cidOk(c) { c = digits(c); if (c.length !== 13) return false; var t = 0; for (var i = 0; i < 12; i++) t += Number(c.charAt(i)) * (13 - i); return (11 - t % 11) % 10 === Number(c.charAt(12)); }
  function pad(n) { return ('0' + n).slice(-2); }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function birthKey(t) {
    t = String(t || '').trim(); if (!t) return '';
    var p = t.split('/'); if (p.length !== 3) { p = t.split('-'); if (p.length === 3 && p[0].length === 4) p = [p[2], p[1], p[0]]; else return null; }
    var d = Number(p[0]), m = Number(p[1]), y = Number(p[2]);
    if (!d || !m || !y) return null; if (y > 2400) y -= 543;
    if (y < 1890 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCDate() !== d) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }
  function beText(k) { if (!k) return ''; var a = String(k).split('-'); return a.length === 3 ? a[2] + '/' + a[1] + '/' + (Number(a[0]) + 543) : String(k); }
  function age(k) { if (!k) return ''; var a = k.split('-').map(Number), b = todayKey().split('-').map(Number); var y = b[0] - a[0] - ((b[1] < a[1] || (b[1] === a[1] && b[2] < a[2])) ? 1 : 0); return y >= 0 ? y + ' ปี' : ''; }
  function isHouse(v) {
    var t = String(v || '').split(' ').join(''); if (!t || t.charAt(0) < '0' || t.charAt(0) > '9') return false;
    for (var i = 1; i < t.length; i++) { var ch = t.charAt(i), last = i === t.length - 1; if ((ch >= '0' && ch <= '9') || ch === '/' || ch === '-') continue; if (last && ch >= 'ก' && ch <= 'ฮ') continue; return false; }
    return true;
  }
  function lists() { var o = {}; Object.keys(DEF).forEach(function(k) { o[k] = (L && L[k] && L[k].length) ? L[k] : DEF[k]; }); return o; }
  function setLists(x) { L = x || null; }
  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>'; }
  function sel(id, list, cur, blank) { var has = !cur || list.indexOf(cur) >= 0; return '<select class="phc-select" id="' + id + '">' + opt('', blank || 'ไม่ระบุ') + list.map(function(x) { return opt(x, x, x === cur); }).join('') + (has ? '' : opt(cur, cur + ' (ค่าเดิม)', true)) + '</select>'; }
  function inp(id, val, attr) { return '<input class="phc-input" id="' + id + '" value="' + esc(val || '') + '" ' + (attr || '') + '>'; }
  function fld(label, inner, req, full) { return '<div class="phc-field' + (full ? ' pk-full' : '') + '"><label class="phc-label">' + esc(label) + (req ? ' <span class="phc-required">*</span>' : '') + '</label>' + inner + '</div>'; }
  function addressText(p) {
    p = p || {};
    return [p.HouseNo, p.AddressDetail, p.Moo ? 'หมู่ ' + p.Moo : '', p.Soi ? 'ซ.' + p.Soi : '', p.Road ? 'ถ.' + p.Road : '', p.SubDistrict ? 'แขวง' + p.SubDistrict : '', p.District ? 'เขต' + p.District : '', p.Province, p.ZipCode]
      .filter(Boolean).join(' ').split('  ').join(' ').trim();
  }
  /* ฟอร์มข้อมูลส่วนตัว · opts = { mode:'new'|'edit', rights:true, socio:true, community:{ list:[{CommunityKey,CommunityName,SubDistrict}], value } , readOnlyNote:'' } */
  function formHtml(px, d, opts) {
    d = d || {}; opts = opts || {}; var Ls = lists(), mode = opts.mode || 'new', isNew = mode === 'new';
    var house = d.HouseNo !== undefined ? d.HouseNo : '', detail = d.AddressDetail || '';
    var cidHint = isNew ? '' : (d.CIDMasked ? 'เดิม ' + d.CIDMasked + ' · กรอกเฉพาะเมื่อต้องการแก้' : 'ยังไม่มีเลขบัตร');
    var gen = d.Gender || (d.Sex === 'MALE' ? 'ชาย' : (d.Sex === 'FEMALE' ? 'หญิง' : ''));
    var h = '<div class="pk-grid" id="' + px + 'Form" data-mode="' + mode + '">';
    if (opts.readOnlyNote) h += '<div class="pk-full pk-warn">' + esc(opts.readOnlyNote) + '</div>';
    h += fld('คำนำหน้า', sel(px + 'Pre', Ls.prefixes, d.Prefix, '-'))
      + fld('เพศ', '<div class="pk-seg" id="' + px + 'Sex">' + Ls.genders.map(function(g) { return '<button type="button" data-v="' + esc(g) + '" class="' + (g === gen ? 'on' : '') + '" onclick="PK.seg(this)">' + esc(g) + '</button>'; }).join('') + '</div>', true)
      + fld('ชื่อ', inp(px + 'Fn', d.FirstName), true) + fld('นามสกุล', inp(px + 'Ln', d.LastName), true)
      + fld('HN', inp(px + 'Hn', d.HN, (isNew || !d.HN) ? '' : 'readonly'))
      + fld('เลขบัตรประชาชน', inp(px + 'Cid', '', 'inputmode="numeric" maxlength="17" placeholder="' + esc(isNew ? '13 หลัก (ตรวจหลักสุดท้ายให้)' : 'กรอกเฉพาะเมื่อต้องการแก้') + '" oninput="PK.cidHint(\'' + px + '\')"') + '<div class="pk-hint" id="' + px + 'CidMsg">' + esc(isNew ? '' : cidHint) + '</div>')
      + fld('วันเกิด (วว/ดด/ปปปป พ.ศ.)', inp(px + 'Bd', d.BirthDate ? beText(d.BirthDate) : '', 'inputmode="numeric" placeholder="เช่น 15/03/2488" oninput="PK.bdHint(\'' + px + '\')"') + '<div class="pk-hint" id="' + px + 'BdMsg">' + (d.BirthDate ? 'อายุ ' + esc(age(d.BirthDate)) : '') + '</div>', true);
    if (opts.rights !== false) {
      h += fld('สิทธิการรักษา', sel(px + 'Main', Ls.mainRights, d.MainRight).split('<select ').join('<select onchange="PK.subFill(\'' + px + '\',\'\')" '))
        + '<div class="phc-field" id="' + px + 'SubWrap"><label class="phc-label">สิทธิย่อย</label><select class="phc-select" id="' + px + 'Sub"></select></div>';
    }
    h += '<div class="pk-full pk-sub">เบอร์โทร <span class="pk-note">หลายเบอร์ได้ · เลือกเบอร์หลัก 1 เบอร์ (เบอร์หลักใช้ร่วมทุกระบบ)</span></div>'
      + '<div class="pk-full"><div class="pk-ph-list" id="' + px + 'Ph"></div><button type="button" class="phc-btn phc-btn--ghost phc-btn--sm" onclick="PK.phAdd(\'' + px + '\')">➕ เพิ่มเบอร์</button></div>'
      + '<div class="pk-full pk-sub">ที่อยู่</div>'
      + fld('บ้านเลขที่', inp(px + 'House', house, 'placeholder="เช่น 12/3"')) + fld('หมู่', inp(px + 'Moo', d.Moo))
      + fld('รายละเอียดที่อยู่ (หมู่บ้าน / อาคาร / ที่อยู่เพิ่มเติม)', inp(px + 'Detail', detail), false, true)
      + fld('ซอย', inp(px + 'Soi', d.Soi)) + fld('ถนน', inp(px + 'Road', d.Road))
      + fld('แขวง / ตำบล', inp(px + 'Sd', d.SubDistrict)) + fld('เขต / อำเภอ', inp(px + 'Dist', d.District))
      + fld('จังหวัด', inp(px + 'Prov', d.Province || (isNew ? 'กรุงเทพมหานคร' : ''))) + fld('รหัสไปรษณีย์', inp(px + 'Zip', d.ZipCode, 'inputmode="numeric" maxlength="5"'));
    if (opts.community) {
      var cl = opts.community.list || [], cv = opts.community.value !== undefined ? opts.community.value : (d.CommunityName || ''), has = !cv || cl.some(function(c) { return c.CommunityName === cv; });
      h += fld('ชุมชน', '<select class="phc-select" id="' + px + 'Comm">' + opt('', 'ไม่ระบุชุมชน') + cl.map(function(c) { return opt(c.CommunityName, c.CommunityName + (c.SubDistrict ? ' (' + c.SubDistrict + ')' : ''), c.CommunityName === cv); }).join('') + (has ? '' : opt(cv, cv, true)) + '</select>', !!opts.community.required);
    }
    if (opts.socio !== false) {
      h += '<div class="pk-full pk-sub">ข้อมูลเพิ่มเติม (ไม่บังคับ)</div>'
        + fld('สถานภาพสมรส', sel(px + 'Mar', Ls.maritalStatuses, d.MaritalStatus)) + fld('ระดับการศึกษา', sel(px + 'Edu', Ls.educationLevels, d.EducationLevel))
        + fld('อาชีพ', sel(px + 'Occ', Ls.occupations, d.Occupation));
    }
    return h + '</div>';
  }
  /* เรียกหลังใส่ formHtml ลงหน้า · phones = [{phone, owner, name, primary}] */
  function mount(px, d, phones) {
    d = d || {};
    if (el(px + 'Main')) subFill(px, d.SubRight || '');
    var rows = (phones && phones.length) ? phones : (d.Phones && d.Phones.length ? d.Phones : (d.Phone ? [{ phone: d.Phone, owner: 'ตนเอง', primary: true }] : []));
    phInit(px, rows);
  }
  function seg(b) { Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), function(x) { x.classList.toggle('on', x === b); }); }
  function segVal(id) { var b = document.querySelector('#' + id + ' button.on'); return b ? b.getAttribute('data-v') : ''; }
  function subFill(px, cur) {
    var m = el(px + 'Main'), s = el(px + 'Sub'), w = el(px + 'SubWrap'); if (!m || !s) return;
    var list = lists().subRights.filter(function(x) { return m.value && (x.parent || x.parentValue) === m.value; });
    var has = !cur || list.some(function(x) { return x.value === cur; });
    s.innerHTML = opt('', 'ไม่ระบุสิทธิย่อย') + list.map(function(x) { return opt(x.value, x.value, x.value === cur); }).join('') + (has ? '' : opt(cur, cur + ' (ค่าเดิม)', true));
    if (w) w.style.display = (list.length || cur) ? '' : 'none';
  }
  function cidHint(px) {
    var v = digits(el(px + 'Cid').value), m = el(px + 'CidMsg'); if (!m) return;
    if (!v) { m.textContent = ''; m.className = 'pk-hint'; return; }
    if (v.length < 13) { m.textContent = 'กรอกแล้ว ' + v.length + '/13 หลัก'; m.className = 'pk-hint'; return; }
    var ok = cidOk(v); m.textContent = ok ? '✓ เลขบัตรถูกต้อง' : '✗ เลขบัตรไม่ถูกต้อง (ตรวจหลักสุดท้ายไม่ผ่าน)'; m.className = 'pk-hint ' + (ok ? 'ok' : 'bad');
  }
  function bdHint(px) { var k = birthKey(el(px + 'Bd').value), m = el(px + 'BdMsg'); if (!m) return; m.textContent = k === null ? 'รูปแบบวันเกิดไม่ถูกต้อง (วว/ดด/ปปปป พ.ศ.)' : (k ? 'อายุ ' + age(k) : ''); m.className = 'pk-hint' + (k === null ? ' bad' : ''); }
  /* เบอร์โทร */
  function phRow(px, r) {
    var Ls = lists(), own = r.owner || 'ตนเอง', owners = Ls.phoneOwners.indexOf(own) >= 0 ? Ls.phoneOwners : Ls.phoneOwners.concat([own]);
    var row = document.createElement('div'); row.className = 'pk-ph' + (own === 'ตนเอง' ? ' pk-self' : '');
    row.innerHTML = '<input class="phc-input pk-tel" inputmode="tel" placeholder="เบอร์โทร" value="' + esc(r.phone || '') + '" aria-label="เบอร์โทร">'
      + '<select class="phc-select pk-own" aria-label="เป็นเบอร์ของ" onchange="PK.phOwner(this)">' + owners.map(function(o) { return opt(o, o === 'ตนเอง' ? 'ของผู้ป่วยเอง' : 'ของ' + o, o === own); }).join('') + '</select>'
      + '<input class="phc-input pk-nm" placeholder="ชื่อเจ้าของเบอร์" value="' + esc(r.name || '') + '" aria-label="ชื่อเจ้าของเบอร์">'
      + '<label class="pk-pr"><input type="radio" name="' + px + 'Prim"' + (r.primary ? ' checked' : '') + '> เบอร์หลัก</label>'
      + '<button type="button" class="pk-x" title="เอาเบอร์นี้ออก" onclick="PK.phDel(this,\'' + px + '\')">✕</button>';
    return row;
  }
  function phInit(px, rows) { var box = el(px + 'Ph'); if (!box) return; box.innerHTML = ''; (rows && rows.length ? rows : [{ owner: 'ตนเอง', primary: true }]).forEach(function(r) { box.appendChild(phRow(px, r)); }); phFix(px); }
  function phAdd(px) { var box = el(px + 'Ph'); box.appendChild(phRow(px, { owner: 'ตนเอง' })); phFix(px); var t = box.querySelectorAll('.pk-tel'); t[t.length - 1].focus(); }
  function phDel(b, px) { var row = b.parentNode, box = el(px + 'Ph'); row.parentNode.removeChild(row); if (!box.querySelector('.pk-ph')) box.appendChild(phRow(px, { owner: 'ตนเอง', primary: true })); phFix(px); }
  function phFix(px) { var box = el(px + 'Ph'); if (box && !box.querySelector('input[type=radio]:checked')) { var f = box.querySelector('input[type=radio]'); if (f) f.checked = true; } }
  function phOwner(s) { var self = s.value === 'ตนเอง'; s.parentNode.classList.toggle('pk-self', self); if (!self) s.parentNode.querySelector('.pk-nm').focus(); }
  function readPhones(px) {
    var out = [], seen = {}, err = '', box = el(px + 'Ph'); if (!box) return { list: [], err: '' };
    Array.prototype.forEach.call(box.querySelectorAll('.pk-ph'), function(row) {
      var ph = row.querySelector('.pk-tel').value.trim(), own = row.querySelector('.pk-own').value, nm = own === 'ตนเอง' ? '' : row.querySelector('.pk-nm').value.trim(), dg = digits(ph);
      if (!ph) { if (nm) err = err || 'กรุณากรอกเบอร์โทรให้ครบทุกแถว (หรือกด ✕ เอาแถวออก)'; return; }
      if (dg.length < 6 || dg.length > 15) err = err || ('เบอร์ ' + ph + ' ไม่ถูกต้อง');
      if (seen[dg]) err = err || ('เบอร์ ' + ph + ' ซ้ำกัน'); seen[dg] = 1;
      out.push({ phone: ph, owner: own, name: nm, primary: row.querySelector('input[type=radio]').checked });
    });
    if (out.length && !out.some(function(r) { return r.primary; })) out[0].primary = true;
    return { list: out, err: err };
  }
  /* อ่านฟอร์ม → { person, phones } หรือ { err } · ตรวจตามมาตรฐานกลาง */
  function read(px, opts) {
    opts = opts || {}; var form = el(px + 'Form'), mode = opts.mode || (form ? form.getAttribute('data-mode') : 'new'), isNew = mode === 'new';
    var g = function(id) { var x = el(px + id); return x ? String(x.value || '').trim() : ''; };
    var o = { Prefix: g('Pre'), Gender: segVal(px + 'Sex'), FirstName: g('Fn'), LastName: g('Ln'), HN: g('Hn'), CID: digits(g('Cid')),
      HouseNo: g('House'), AddressDetail: g('Detail'), Moo: g('Moo'), Soi: g('Soi'), Road: g('Road'), SubDistrict: g('Sd'), District: g('Dist'), Province: g('Prov'), ZipCode: digits(g('Zip')) };
    if (el(px + 'Main')) { o.MainRight = g('Main'); o.SubRight = g('Sub'); }
    if (el(px + 'Mar')) { o.MaritalStatus = g('Mar'); o.EducationLevel = g('Edu'); o.Occupation = g('Occ'); }
    if (el(px + 'Comm')) o.CommunityName = g('Comm');
    o.Sex = o.Gender === 'ชาย' ? 'MALE' : (o.Gender === 'หญิง' ? 'FEMALE' : '');
    var bd = birthKey(g('Bd'));
    if (!o.FirstName || !o.LastName) return { err: 'กรุณากรอกชื่อและนามสกุล' };
    if (isNew && !o.HN && !o.CID) return { err: 'กรุณาระบุ HN หรือเลขบัตรประชาชนอย่างน้อย 1 อย่าง' };
    if (o.CID && !cidOk(o.CID)) return { err: 'เลขบัตรประชาชนไม่ถูกต้อง (ตรวจหลักสุดท้ายไม่ผ่าน)' };
    if (isNew && !o.Gender) return { err: 'กรุณาเลือกเพศ' };
    if (bd === null) return { err: 'วันเกิดไม่ถูกต้อง (วว/ดด/ปปปป พ.ศ.)' };
    if (isNew && !bd) return { err: 'กรุณาระบุวันเกิด' };
    if (bd && bd > todayKey()) return { err: 'วันเกิดต้องไม่เป็นวันที่ในอนาคต' };
    if (o.ZipCode && o.ZipCode.length !== 5) return { err: 'รหัสไปรษณีย์ต้องมี 5 หลัก' };
    if (opts.communityRequired && el(px + 'Comm') && !o.CommunityName) return { err: 'กรุณาเลือกชุมชน' };
    o.BirthDate = bd || '';
    var ph = readPhones(px); if (ph.err) return { err: ph.err };
    var prim = ph.list.filter(function(r) { return r.primary; })[0];
    o.Phone = prim ? prim.phone : '';
    o.AddressText = addressText(o);
    o.FullName = [o.Prefix + o.FirstName, o.LastName].filter(Boolean).join(' ');
    return { person: o, phones: ph.list };
  }
  /* กล่องรายชื่อที่อาจซ้ำ · pickFn(index) / confirmFn() เป็นชื่อฟังก์ชันของหน้าเว็บ */
  function dupHtml(res, pickFn, confirmFn) {
    var hard = !!(res.duplicateCID || res.duplicateHN), rows = res.matches || [];
    return '<div class="pk-dup"><b>' + esc(hard ? 'มีผู้ป่วยที่ใช้เลขบัตรประชาชนหรือ HN นี้อยู่แล้วในเวชระเบียนกลาง — กรุณาเลือกคนเดิม' : 'พบผู้ป่วยชื่อ-สกุล (และวันเกิด) ตรงกันในเวชระเบียนกลาง — ตรวจก่อนว่าเป็นคนเดียวกันหรือไม่') + '</b>'
      + '<table>' + rows.map(function(m, i) { var p = m.patient || m; return '<tr><td>' + esc(m.reason || '') + '</td><td><b>' + esc(p.FullName || p.fullName || p.name || '') + '</b><br><span class="pk-note">HN ' + esc(p.HN || p.hn || '-') + ' · ' + esc(p.CIDMasked || p.cidMasked || 'ไม่มีเลขบัตร') + ' · เกิด ' + esc(p.BirthDateBE || p.birthDateBE || '-') + '</span></td><td>' + (pickFn ? '<button type="button" class="phc-btn phc-btn--sm" onclick="' + pickFn + '(' + i + ')">ใช้คนนี้</button>' : '') + '</td></tr>'; }).join('') + '</table>'
      + (hard || !confirmFn ? '' : '<div style="margin-top:8px"><button type="button" class="phc-btn phc-btn--secondary phc-btn--sm" onclick="' + confirmFn + '()">ยืนยันเพิ่มใหม่ (คนละคน)</button></div>') + '</div>';
  }
  /* ช่องที่เปลี่ยน (ใช้แสดงยืนยันก่อนส่งเวชระเบียนกลาง) */
  var LABEL = { Prefix: 'คำนำหน้า', FirstName: 'ชื่อ', LastName: 'นามสกุล', Gender: 'เพศ', BirthDate: 'วันเกิด', CID: 'เลขบัตร', HouseNo: 'บ้านเลขที่', AddressDetail: 'รายละเอียดที่อยู่', Moo: 'หมู่', Soi: 'ซอย', Road: 'ถนน', SubDistrict: 'แขวง', District: 'เขต', Province: 'จังหวัด', ZipCode: 'รหัสไปรษณีย์', MainRight: 'สิทธิ', SubRight: 'สิทธิย่อย', MaritalStatus: 'สถานภาพ', EducationLevel: 'การศึกษา', Occupation: 'อาชีพ', Phone: 'เบอร์หลัก' };
  function changed(before, after) { before = before || {}; return Object.keys(LABEL).filter(function(k) { return after[k] !== undefined && String(after[k] || '') !== String(before[k] || '') && !(k === 'CID' && !after[k]); }).map(function(k) { return LABEL[k]; }); }
  return { VERSION: VERSION, setLists: setLists, lists: lists, formHtml: formHtml, mount: mount, read: read, readPhones: readPhones, dupHtml: dupHtml, changed: changed,
    seg: seg, segVal: segVal, subFill: subFill, cidHint: cidHint, bdHint: bdHint, phAdd: phAdd, phDel: phDel, phOwner: phOwner,
    cidOk: cidOk, digits: digits, birthKey: birthKey, beText: beText, age: age, isHouse: isHouse, addressText: addressText, esc: esc };
})();

/* ===================== หน้าต่างฟอร์มผู้ป่วย (ระบบใหม่) ===================== */
window.PHC37PatientForm = (function () {
  'use strict';
  var P = window.PHC37;
  var F = { open: false, opts: null, data: null, mode: 'new', dup: [], busy: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return PK.esc(s); }
  function root() {
    var r = $('pf-root');
    if (!r) { r = document.createElement('div'); r.id = 'pf-root'; document.body.appendChild(r); }
    return r;
  }
  function frame(title, body, foot) {
    root().innerHTML = '<div class="modal-wrap" id="pf-wrap"><div class="modal lg" role="dialog" aria-modal="true" aria-labelledby="pf-title">'
      + '<div class="modal-head"><h3 id="pf-title">' + esc(title) + '</h3><button class="xbtn" type="button" id="pf-x" aria-label="ปิด">×</button></div>'
      + '<div class="modal-body" id="pf-body">' + body + '</div>' + (foot ? '<div class="modal-foot" id="pf-foot">' + foot + '</div>' : '') + '</div></div>';
    $('pf-x').addEventListener('click', close);
    $('pf-wrap').addEventListener('mousedown', function (e) { if (e.target === this) close(); });
    document.body.classList.add('pf-lock');
  }
  function close() {
    if (F.busy) return;
    F.open = false; root().innerHTML = ''; document.body.classList.remove('pf-lock');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && F.open && !F.busy) close(); });

  function msg(text, kind) {
    var m = $('pf-msg'); if (!m) return;
    m.className = 'alert-row ' + (kind || 'd'); m.textContent = text || ''; m.hidden = !text;
    if (text) m.scrollIntoView({ block: 'nearest' });
  }
  function commOpt(d) { return { list: (F.data.communities || []).map(function (c) { return { CommunityName: c.CommunityName }; }), value: d.CommunityName || '' }; }

  /**
   * เปิดฟอร์ม · opts = { patientID (แก้ไข) | prefill (เพิ่มใหม่), onSaved(res), onPick(patientID),
   *   onPending(draft) + onFailed(message, draft) = แก้ไขแบบแสดงผลทันที (ปิดฟอร์มก่อน บันทึกเบื้องหลัง),
   *   draft = { person, phones } เปิดฟอร์มพร้อมค่าที่เคยกรอก (หลังบันทึกไม่สำเร็จ) }
   */
  function open(opts) {
    F.opts = opts || {}; F.mode = F.opts.patientID ? 'edit' : 'new'; F.dup = []; F.open = true; F.busy = false;
    frame(F.mode === 'edit' ? 'แก้ไขข้อมูลผู้ป่วย' : 'เพิ่มข้อมูลผู้ป่วย', '<div id="pf-load"></div>', '');
    P.skeleton($('pf-load'), 6);
    var data = { token: P.token() };
    if (F.opts.patientID) data.patientID = F.opts.patientID;
    P.api('patient.formData', data).then(function (r) {
      if (!F.open) return;
      if (!r.ok) {
        if (r.code === 'unauthorized') { close(); P.showLogin(r.message); return; }
        $('pf-body').innerHTML = '<div class="alert-row d">' + esc(r.message) + '</div>'; return;
      }
      F.data = r; PK.setLists(r.lists);
      var x = r.patient || F.opts.prefill || {};
      if (F.opts.draft) {   // ค่าที่ผู้ใช้กรอกไว้ก่อนบันทึกไม่สำเร็จ
        var dp = F.opts.draft.person || {};
        x = Object.assign({}, x, dp, { CIDMasked: x.CIDMasked, PatientID: x.PatientID, Phones: F.opts.draft.phones || x.Phones });
      }
      render(x);
      if (F.opts.draftError) msg(F.opts.draftError);
    });
  }

  function render(x) {
    var isNew = F.mode === 'new', d = F.data;
    var allowed = isNew ? d.canAdd : d.canEdit;
    var warn = !d.writeReady ? 'ยังบันทึกจากหน้านี้ไม่ได้ — รอติดตั้งทางบันทึกที่ Gateway เดิม (ระหว่างนี้เพิ่ม/แก้ที่ Gateway เดิมหรือแอพลูก)'
      : (!allowed ? 'บัญชีของคุณไม่มีสิทธิ์ "' + (isNew ? 'เพิ่ม' : 'แก้ไข') + '" เวชระเบียนกลาง — ดูได้อย่างเดียว' : '');
    var head = isNew
      ? '<div class="alert-row w pf-head">ค้นหาก่อนเพิ่มเสมอ · ช่อง * ต้องกรอก · ใส่ HN หรือเลขบัตรอย่างน้อย 1 อย่าง · ระบบตรวจผู้ป่วยซ้ำในเวชระเบียนกลางให้ก่อนบันทึก</div>'
      : '<div class="alert-row i pf-head"><b>HN ' + esc(x.HN || '-') + ' · ' + esc(x.CIDMasked || 'ไม่มีเลขบัตร') + '</b><span>รหัสผู้ป่วย ' + esc(x.PatientID || '') + ' · บันทึกแล้วทุกระบบเห็นตรงกัน</span></div>';
    var extra = '<div class="pk-grid pf-extra"><div class="pk-full pk-sub">ข้อมูลเวชระเบียนกลาง</div>'
      + '<div class="phc-field"><label class="phc-label" for="pfStatus">สถานะ</label><select class="phc-select" id="pfStatus">'
      + '<option value="active"' + (x.Status !== 'inactive' ? ' selected' : '') + '>ใช้งาน</option><option value="inactive"' + (x.Status === 'inactive' ? ' selected' : '') + '>ปิดใช้งาน</option></select></div>'
      + '<div class="phc-field pk-full"><label class="phc-label" for="pfNote">หมายเหตุ</label><textarea class="phc-input pf-note" id="pfNote" rows="2" maxlength="300" placeholder="หมายเหตุเพิ่มเติม">' + esc(x.Note || '') + '</textarea></div></div>';
    $('pf-body').innerHTML = '<div id="pf-msg" class="alert-row d" hidden></div><div id="pkDup"></div>' + head
      + (warn ? '<div class="pk-warn">' + esc(warn) + '</div>' : '')
      + PK.formHtml('pk', x, { mode: F.mode, community: commOpt(x) }) + extra;
    var foot = $('pf-foot');
    if (!foot) { foot = document.createElement('div'); foot.className = 'modal-foot'; foot.id = 'pf-foot'; $('pf-body').parentNode.appendChild(foot); }
    foot.innerHTML = '<button class="phc-btn phc-btn--secondary" type="button" id="pf-cancel">ยกเลิก</button>'
      + '<button class="phc-btn" type="button" id="pf-save"' + (warn ? ' disabled' : '') + '>' + (isNew ? 'เพิ่มเข้าเวชระเบียนกลาง' : 'บันทึก') + '</button>';
    $('pf-cancel').addEventListener('click', close);
    $('pf-save').addEventListener('click', function () { save(false); });
    PK.mount('pk', x, x.Phones);
    F.before = x;
    var first = $('pkFn'); if (first && isNew) setTimeout(function () { first.focus(); }, 30);
  }

  function save(force) {
    var r = PK.read('pk', { mode: F.mode });
    if (r.err) { msg(r.err); return; }
    var person = r.person;
    var cname = person.CommunityName || '';
    var c = (F.data.communities || []).filter(function (x) { return x.CommunityName === cname; })[0];
    person.CommunityKey = c ? c.CommunityKey : (cname && cname === F.before.CommunityName ? F.before.CommunityKey : '');
    if (cname && !person.CommunityKey) { msg('ชุมชน "' + cname + '" ไม่อยู่ในรายการ กรุณาเลือกใหม่'); return; }
    person.Status = $('pfStatus').value; person.Note = $('pfNote').value.trim();
    msg('');
    var req = { token: P.token(), patientID: F.opts.patientID || '', person: person, phones: r.phones, forceCreate: force === true };
    var draft = { person: person, phones: r.phones };
    // แก้ไข: ปิดฟอร์มทันที แสดงค่าใหม่ บันทึกเบื้องหลัง (ช่วงเปลี่ยนผ่านต้องรอ Gateway เดิม 2–5 วิ)
    if (F.mode === 'edit' && F.opts.onPending) {
      var o = F.opts;
      close();
      o.onPending(draft);
      P.api('patient.save', req).then(function (res) {
        if (res.ok) { if (o.onSaved) o.onSaved(res); return; }
        if (res.code === 'unauthorized') { P.showLogin(res.message); return; }
        if (o.onFailed) o.onFailed(res.message || 'บันทึกไม่สำเร็จ', draft); else P.toast(res.message, 'err');
      });
      return;
    }
    // เพิ่มใหม่: ต้องรอผลตรวจซ้ำ → บอกขั้นตอนบนปุ่ม
    var btn = $('pf-save'); P.busy(btn, true, 'กำลังตรวจข้อมูล...'); F.busy = true;
    var t0 = Date.now(), tick = setInterval(function () {
      var sec = (Date.now() - t0) / 1000, lab = btn.lastChild;
      if (!F.busy || !lab || lab.nodeType !== 3) { clearInterval(tick); return; }
      lab.nodeValue = sec < 1 ? 'กำลังตรวจข้อมูล...' : (sec < 6 ? 'ตรวจซ้ำและบันทึกลงเวชระเบียนกลาง... ' + Math.floor(sec) + ' วิ' : 'ใกล้เสร็จแล้ว... ' + Math.floor(sec) + ' วิ');
    }, 250);
    P.api('patient.save', req).then(function (res) {
      F.busy = false; clearInterval(tick); P.busy(btn, false);
      if (!F.open) return;
      if (res.duplicate) {
        F.dup = res.matches || [];
        $('pkDup').innerHTML = PK.dupHtml(res, 'PHC37PatientForm._dupPick', res.canForceCreate ? 'PHC37PatientForm._dupConfirm' : '');
        $('pkDup').scrollIntoView({ block: 'start' });
        return;
      }
      if (!res.ok) { if (res.code === 'unauthorized') { close(); P.showLogin(res.message); return; } msg(res.message); return; }
      var cb = F.opts.onSaved;
      close();
      P.toast(res.message + (res.warn ? ' · ' + res.warn : ''), res.warn ? 'err' : 'ok');
      if (cb) cb(res);
    });
  }
  function dupPick(i) {
    var m = F.dup[i]; if (!m || !m.patient || !m.patient.PatientID) return;
    var pid = m.patient.PatientID, cb = F.opts.onPick;
    close();
    if (cb) cb(pid); else if (window.PHC37Patients) window.PHC37Patients.openPatient(pid);
  }
  function dupConfirm() { save(true); }

  return { open: open, close: close, _dupPick: dupPick, _dupConfirm: dupConfirm };
})();
