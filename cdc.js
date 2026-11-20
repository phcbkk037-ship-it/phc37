/* PHC37 PWA — cdc.js (PHC37-PWA-CDC-1.0.0) : ระบบเฝ้าระวัง ติดตาม และควบคุมโรคติดต่อ — หน้าเดิมทั้งหน้า (cdc.html) ในแอปใหม่
 * ผู้ใช้เลือก 20 พ.ย.: นำเข้าครั้งเดียวแล้วใช้จริงทันที · ข้อมูลระบุตัวตนเข้ารหัสที่ Edge
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('cdc-frame'); if (!f || $('view-cdc').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('cdc-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('cdc.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบเฝ้าระวัง ติดตาม และควบคุมโรคติดต่อไม่สำเร็จ', 'err'); return;
      }
      P.show('view-cdc');
      P.setPage('cdc', (S.menu && S.menu.name) || 'ระบบเฝ้าระวัง ติดตาม และควบคุมโรคติดต่อ');
      try { history.pushState({ phc37View: 'cdc' }, ''); } catch (e) {}
      banner(r);
      var f = $('cdc-frame');
      if (!S.loaded) { f.src = 'cdc.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Cdc = { open: open, reload: function () { var f = $('cdc-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
