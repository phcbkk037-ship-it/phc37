/* PHC37 PWA — wbc.js (PHC37-PWA-WBC-1.0.0) : คลินิกสุขภาพเด็กดี (WBC) — หน้าเดิมทั้งหน้า (wbc.html) ในแอปใหม่
 * ผู้ใช้เลือก 20 พ.ย.: นำเข้าครั้งเดียวแล้วใช้จริงทันที · ข้อมูลระบุตัวตนเด็ก + LINE + ข้อความอิสระ เข้ารหัสที่ Edge
 * LINE OA คลินิกเด็กดี: webhook/LINE Login → Edge · หน้าเชื่อม LINE ของผู้ปกครอง = wbcline.html · ส่งตามเวลา = ทริกเกอร์สะพาน
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('wbc-frame'); if (!f || $('view-wbc').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('wbc-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('wbc.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบคลินิกเด็กดี ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-wbc');
      P.setPage('wbc', (S.menu && S.menu.name) || 'คลินิกสุขภาพเด็กดี (WBC)');
      try { history.pushState({ phc37View: 'wbc' }, ''); } catch (e) {}
      banner(r);
      var f = $('wbc-frame');
      if (!S.loaded) { f.src = 'wbc.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Wbc = { open: open, reload: function () { var f = $('wbc-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
