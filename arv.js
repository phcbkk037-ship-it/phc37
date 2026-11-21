/* PHC37 PWA — arv.js (PHC37-PWA-ARV-1.0.0) : ระบบติดตามการรักษาและรับยากลุ่มผู้ป่วย ARV (ARV2 · สร้างใหม่) — หน้า arv.html ในแอปใหม่
 * ผู้ใช้เลือก 21 พ.ย.: สร้างใหม่ตามแบบ WBC / IC · เมนูเดิม 7 หน้า · เข้ารหัสตัวตน / ข้อความ / LINE / ผล Lab / ปัจจัยเสี่ยง / สูตรยา ที่ Edge
 * LINE OA FollowUp037 (ผู้ป่วย + เจ้าหน้าที่): หน้า LINE สาธารณะ = arvline.html · ส่งตามเวลา + ตรวจขาดนัด = ตัวตั้งเวลาสะพาน
 * เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { menu: null, loaded: false };

  function fit() {
    var f = $('arv-frame'); if (!f || $('view-arv').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function banner(r) {
    var b = $('arv-note');
    if (r && r.readOnly) {
      b.hidden = false;
      b.textContent = '⏳ ยังไม่ได้นำข้อมูลจากระบบเดิมเข้ามา — หน้านี้ดูได้อย่างเดียว';
    } else b.hidden = true;
  }
  function open(menu) {
    S.menu = menu || S.menu;
    P.api('arv.access', { token: P.token() }).then(function (r) {
      if (r && !r.ok && r.code === 'unauthorized') return;
      if (!r.ok) {
        if (r.code === 'not_live' && S.menu && P.openMenu) { P.openMenu(S.menu); return; }
        P.toast(r.message || 'เปิดระบบ ARV ไม่สำเร็จ', 'err'); return;
      }
      P.show('view-arv');
      P.setPage('arv', (S.menu && S.menu.name) || 'ระบบติดตามการรักษาและรับยากลุ่มผู้ป่วย ARV');
      try { history.pushState({ phc37View: 'arv' }, ''); } catch (e) {}
      banner(r);
      var f = $('arv-frame');
      if (!S.loaded) { f.src = 'arv.html?v=' + encodeURIComponent(r.version || ''); S.loaded = true; }
      setTimeout(fit, 0);
    });
  }
  window.addEventListener('resize', fit);
  window.PHC37Arv = { open: open, reload: function () { var f = $('arv-frame'); if (f && S.loaded) f.contentWindow.location.reload(); } };
})();
