/* PHC37 PWA — ic.js (PHC37-PWA-IC-1.0.0) : ระบบเฝ้าระวังการติดเชื้อหลังทำหัตถการ (IC Watch) — หน้าเดิมทั้งหน้า (ic.html) ในแอปใหม่
 * ผู้ใช้เลือก 21 พ.ย.: นำเข้าครั้งเดียวแล้วใช้จริงทันที · ตัวตนผู้ป่วย + LINE เจ้าหน้าที่ + หมายเหตุ เข้ารหัสที่ Edge
 * LINE OA "IC ศบส.37" (เจ้าหน้าที่เท่านั้น): หน้าเชื่อม LINE = icline.html · ส่งแจ้งเตือนตามเวลา = ตัวตั้งเวลาสะพาน
 * ปุ่ม "เปิดเคส" ในข้อความ LINE → ./?open=ic&case=… → app.js เก็บรหัสเคส → เปิดหน้านี้ → หน้าเดิมเปิดเคสเอง
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('ic-frame'); if (!f || $('view-ic').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('ic-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว';
    } else b.hidden = true;
  }
  function open(menu, done) {
    S.menu = menu || S.menu;
    P.api('ic.access', { token: P.token() }).then(function (r) {
      if (done) done(r);
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบ IC Watch ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-ic');
      P.setPage('ic', (S.menu && S.menu.name) || 'ระบบเฝ้าระวังการติดเชื้อหลังทำหัตถการ (IC Watch)');
      try { history.pushState({ phc37View: 'ic' }, ''); } catch (e) {}
      banner(r);
      var f = $('ic-frame'), pending = false;
      try { pending = !!sessionStorage.getItem('phc37.icOpenCase'); } catch (e) {}
      if (!S.loaded) { f.src = 'ic.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      else if (pending) f.contentWindow.location.reload();   // เปิดเคสจาก LINE ขณะหน้าเปิดอยู่แล้ว → โหลดใหม่ให้หน้าเดิมอ่านรหัสเคส
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Ic = { open: open, reload: function () { var f = $('ic-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
