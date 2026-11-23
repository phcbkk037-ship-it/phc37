/* PHC37 PWA — svy.js (PHC37-PWA-SURVEY-1.0.2 · 23 พ.ย. 2569) : ระบบแบบสอบถามกลาง — เปิดหน้า svy.html ในแอป + ป้าย "รอตอบ"
 * 1.0.2: จำนวนรอตอบเปลี่ยน (ตอบเสร็จ) → รีเฟรชตัวเลขงานของฉัน/กระดิ่งทันที (งานจากระบบ)
 * 1.0.1: มีเมนู survey_center ในหน้าสิทธิ์และเมนู — ปิดใช้งาน/ปิดปรับปรุง = ไม่นับป้ายรอตอบ (superadmin ยังเห็น)
 * ทุกคนที่เข้าสู่ระบบใช้ได้ (เมนู "แบบสอบถาม" ด้านซ้าย) · ป้ายตัวเลข = แบบสอบถามที่แจกถึงฉันและยังไม่ได้ตอบ
 * หน้าแรกแสดงแถบ "มีแบบสอบถามรอคุณตอบ N ชุด" เมื่อมี · เมนูซ้ายของระบบอยู่ในหน้า (ปุ่ม "กลับหน้าหลัก") → ซ่อนเมนู Gateway ระหว่างเปิด */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { loaded: false, count: 0, last: 0, busy: false };

  (function css() {
    var st = document.createElement('style');
    st.textContent = '.svy-home{display:flex;align-items:center;gap:10px;background:#EAF6EC;border:1px solid #BFE3C6;border-radius:14px;padding:10px 12px;margin:0 0 12px;color:#14532D}' +
      '.svy-home[hidden]{display:none}.svy-home-ic{font-size:22px}.svy-home-text{flex:1;font-weight:600;line-height:1.4}' +
      '.svy-home-go{border:0;background:#15703A;color:#fff;border-radius:10px;min-height:38px;padding:0 14px;font-weight:600;cursor:pointer;font-family:inherit}';
    document.head.appendChild(st);
  })();

  function fit() {
    var f = $('svy-frame'); if (!f || $('view-svy').hidden) return;
    var top = f.getBoundingClientRect().top;
    f.style.height = Math.max(420, window.innerHeight - top) + 'px';
  }
  function on() { return !P.surveyOn || P.surveyOn(); }
  function paint(n) {
    S.count = on() ? (n || 0) : 0;
    var b = $('nav-svy-badge'); if (b) { b.textContent = String(S.count); b.hidden = !S.count; }
    var h = $('home-svy');
    if (h) { h.hidden = !S.count; $('home-svy-text').textContent = 'มีแบบสอบถามรอคุณตอบ ' + S.count + ' ชุด'; }
  }
  /** นับรอตอบ (ไม่บ่อยกว่า 2 นาที ยกเว้น force) */
  function refresh(force) {
    if (!P.token() || S.busy) return;
    if (!on()) { paint(0); return; }
    if (!force && Date.now() - S.last < 120000) return;
    S.busy = true;
    P.api('svy.inbox', { token: P.token() }).then(function (r) {
      S.busy = false; S.last = Date.now();
      if (r && r.ok) paint((r.items || []).length);
    }, function () { S.busy = false; });
  }
  function open(view) {
    P.show('view-svy');
    P.setPage('svy', 'ระบบแบบสอบถามกลาง');
    try { history.pushState({ phc37View: 'svy' }, ''); } catch (e) {}
    var f = $('svy-frame');
    var want = view || (S.count ? 'inbox' : 'mine');
    if (!S.loaded) { f.src = 'svy.html?v=2.19.0#' + want; S.loaded = true; }
    else { try { f.contentWindow.SvyApp.go(want); } catch (e) { f.contentWindow.location.hash = want; } }
    setTimeout(fit, 0);
  }
  var go = $('home-svy-go'); if (go) go.addEventListener('click', function () { open('inbox'); });
  window.addEventListener('resize', fit);
  window.PHC37Survey = { open: open, refresh: refresh, badge: function (n) {
    var before = S.count; paint(n); S.last = Date.now();
    if (before !== undefined && before !== S.count && window.PHC37Tasks) window.PHC37Tasks.refresh(true);
  } };
  if (P.token()) setTimeout(function () { refresh(true); }, 1500);
})();
