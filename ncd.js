/* PHC37 PWA — ncd.js (PHC37-PWA-NCD-1.0.0) : ระบบบริหารการดูแลผู้ป่วย NCD — หน้าเดิมทั้งหน้า (ncd.html) ในแอปใหม่
 * ผู้ใช้เลือก 20 พ.ย.: นำเข้าครั้งเดียวแล้วใช้จริงทันที · ข้อมูลระบุตัวตน + HN + ข้อความอิสระ เข้ารหัสที่ Edge
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('ncd-frame'); if (!f || $('view-ncd').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('ncd-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว ใช้ระบบเดิมไปก่อน';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('ncd.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบ NCD ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-ncd');
      P.setPage('ncd', (S.menu && S.menu.name) || 'ระบบบริหารการดูแลผู้ป่วย NCD');
      try { history.pushState({ phc37View: 'ncd' }, ''); } catch (e) {}
      banner(r);
      var f = $('ncd-frame');
      if (!S.loaded) { f.src = 'ncd.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Ncd = { open: open, reload: function () { var f = $('ncd-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
