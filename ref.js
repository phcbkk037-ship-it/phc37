/* PHC37 PWA — ref.js (PHC37-PWA-REF-1.0.0) : ระบบส่งต่อกลาง — หน้าเดิมทั้งหน้า (ref.html) ในแอปใหม่
 * ผู้ใช้เลือก 20 พ.ย.: ย้ายพร้อมกัน 4 ระบบ (ส่งต่อกลาง · IMC · ผ้าอ้อม · สังคมฯ) นำเข้าครั้งเดียวแล้วใช้จริงทันที · ข้อมูลระบุตัวตนเข้ารหัสที่ Edge
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('ref-frame'); if (!f || $('view-ref').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('ref-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('ref.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบส่งต่อกลางไม่สำเร็จ', 'err'); return;
      }
      P.show('view-ref');
      P.setPage('ref', (S.menu && S.menu.name) || 'ระบบส่งต่อกลาง');
      try { history.pushState({ phc37View: 'ref' }, ''); } catch (e) {}
      banner(r);
      var f = $('ref-frame');
      if (!S.loaded) { f.src = 'ref.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Ref = { open: open, reload: function () { var f = $('ref-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
