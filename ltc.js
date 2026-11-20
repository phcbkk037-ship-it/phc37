/* PHC37 PWA — ltc.js (PHC37-PWA-LTC-1.0.0) : ระบบดูแลและติดตามผู้มีภาวะพึ่งพิง (LTC) — หน้าเดิมทั้งหน้า (ltc.html) ในแอปใหม่
 * ผู้ใช้เลือก 20 พ.ย.: ย้ายแบบเดิม (เลิกจำกัดชุมชนแล้วตั้งแต่ LTC-REVIEW) · นำเข้าครั้งเดียวแล้วใช้จริงทันที · ข้อมูลระบุตัวตน+พิกัดบ้านเข้ารหัสที่ Edge
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('ltc-frame'); if (!f || $('view-ltc').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('ltc-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('ltc.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบ LTC ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-ltc');
      P.setPage('ltc', (S.menu && S.menu.name) || 'ระบบดูแลและติดตามผู้มีภาวะพึ่งพิง');
      try { history.pushState({ phc37View: 'ltc' }, ''); } catch (e) {}
      banner(r);
      var f = $('ltc-frame');
      if (!S.loaded) { f.src = 'ltc.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Ltc = { open: open, reload: function () { var f = $('ltc-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
