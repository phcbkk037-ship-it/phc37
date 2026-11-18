/* PHC37 PWA — material.js (PHC37-PWA-MATERIAL-1.0.0) : ระบบเบิก–จ่ายวัสดุ — หน้าเดิมทั้งหน้า (mr.html) ในแอปใหม่
 * ผู้ใช้เลือก 18 พ.ย.: ใช้โค้ดและหน้าตาเดิม (เมนูซ้ายของระบบพัสดุอยู่ในหน้า) · ใช้คู่กับระบบเดิมจนกว่าจะปิดระบบเดิม
 * ช่วงใช้คู่กัน: ข้อมูลดึงจากระบบเดิมทุก 15 นาที และดูอย่างเดียว (แถบแจ้งด้านบน) */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('mr-frame'); if (!f || $('view-material').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('mr-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '🔁 ช่วงใช้คู่กับระบบเดิม: หน้านี้ดูข้อมูลได้อย่างเดียว (ข้อมูลจากระบบเดิม' +
        (r.lastSync ? ' ล่าสุด ' + P.fmtTime(r.lastSync) : '') + ') — เขียน อนุมัติ จ่าย ใช้ระบบเดิมตามปกติ';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('mr.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบเบิก–จ่ายวัสดุไม่สำเร็จ', 'err'); return;
      }
      P.show('view-material');
      P.setPage('material', (S.menu && S.menu.name) || 'ระบบเบิก–จ่ายวัสดุ');
      try { history.pushState({ phc37View: 'material' }, ''); } catch (e) {}
      banner(r);
      var f = $('mr-frame');
      if (!S.loaded) { f.src = 'mr.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Material = { open: open, reload: function () { var f = $('mr-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
