/* PHC37 PWA — itasset.js (PHC37-PWA-ITASSET-1.0.0) : ทะเบียนครุภัณฑ์คอมพิวเตอร์และแจ้งซ่อม — หน้าเดิมทั้งหน้า (it.html) ในแอปใหม่
 * ผู้ใช้เลือก 18 พ.ย.: ระบบแรกที่ใช้จริงบนระบบใหม่ (นำเข้าจากชีตเดิมครั้งเดียว แล้วบันทึกได้ทันที) · QR สติกเกอร์ = report.html ของแอปนี้
 * เมนูซ้ายของระบบครุภัณฑ์อยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('ita-frame'); if (!f || $('view-itasset').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('ita-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('ita.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบครุภัณฑ์คอมพิวเตอร์ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-itasset');
      P.setPage('itasset', (S.menu && S.menu.name) || 'ทะเบียนครุภัณฑ์คอมพิวเตอร์และแจ้งซ่อม');
      try { history.pushState({ phc37View: 'itasset' }, ''); } catch (e) {}
      banner(r);
      var f = $('ita-frame');
      if (!S.loaded) { f.src = 'it.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37ItAsset = { open: open, reload: function () { var f = $('ita-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
