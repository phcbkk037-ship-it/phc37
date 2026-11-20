/* PHC37 PWA — imc.js (PHC37-PWA-IMC-1.0.0) : ระบบฟื้นฟูสมรรถภาพผู้ป่วยระยะกลาง (IMC) — หน้าเดิมทั้งหน้า (imc.html) ในแอปใหม่
 * ผู้ใช้เลือก 20 พ.ย.: ย้ายพร้อมกัน 4 ระบบ (ส่งต่อกลาง · IMC · ผ้าอ้อม · สังคมฯ) นำเข้าครั้งเดียวแล้วใช้จริงทันที · ข้อมูลระบุตัวตนเข้ารหัสที่ Edge
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('imc-frame'); if (!f || $('view-imc').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('imc-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('imc.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบฟื้นฟูสมรรถภาพผู้ป่วยระยะกลาง (IMC)ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-imc');
      P.setPage('imc', (S.menu && S.menu.name) || 'ระบบฟื้นฟูสมรรถภาพผู้ป่วยระยะกลาง (IMC)');
      try { history.pushState({ phc37View: 'imc' }, ''); } catch (e) {}
      banner(r);
      var f = $('imc-frame');
      if (!S.loaded) { f.src = 'imc.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Imc = { open: open, reload: function () { var f = $('imc-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
