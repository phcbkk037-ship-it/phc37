/* PHC37 PWA — public.js (PHC37-PWA-PUBLIC-1.0.2) : สมัครใช้งาน + ลืมรหัสผ่าน */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var opts = null;

  function backToLogin(msg, info) {
    P.showLogin(msg || '');
    if (msg && info) $('login-alert').className = 'alert info';
  }

  // ---------- สมัครใช้งาน ----------
  function openRegister() {
    P.show('view-register');
    P.setAlert('reg-alert', '');
    $('reg-fields').hidden = false;
    ['reg-fullname', 'reg-username', 'reg-email', 'reg-reason', 'reg-website']
      .forEach(function (id) { $(id).value = ''; });
    window.scrollTo(0, 0);
    if (opts) { fillCombos(); $('reg-fullname').focus(); return; }
    var btn = $('btn-register'); P.busy(btn, true, 'กำลังโหลดตัวเลือก...');
    P.api('public.registerOptions', {}).then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('reg-alert', res.message);
      opts = res;
      var sel = $('reg-workgroup');
      while (sel.options.length > 1) sel.remove(1);
      res.workgroups.forEach(function (g) { var o = document.createElement('option'); o.value = g.key; o.textContent = g.label; sel.appendChild(o); });
      fillCombos();
      $('reg-fullname').focus();
    });
  }

  function fillCombos() {
    P.comboFill('reg-position', opts.positions, '— เลือกตำแหน่ง —', opts.positionGroups);
    P.comboFill('reg-affiliation', opts.affiliations, '— เลือกสังกัด —');
    $('reg-workgroup').value = '';
    $('reg-workgroup').classList.add('placeholder');
    syncWorkgroup();
  }
  /** กลุ่มงาน: แสดงเฉพาะเมื่อสังกัดเป็น ศบส.37 */
  function syncWorkgroup() {
    var main = P.isMainAffiliation(P.comboValue('reg-affiliation'));
    $('reg-workgroup-wrap').hidden = !main;
    if (!main) $('reg-workgroup').value = '';
  }
  $('reg-affiliation').addEventListener('change', syncWorkgroup);
  $('reg-affiliation-other').addEventListener('input', syncWorkgroup);
  $('reg-workgroup').addEventListener('change', function () { $('reg-workgroup').classList.toggle('placeholder', !$('reg-workgroup').value); });

  $('form-register').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = {
      fullName: $('reg-fullname').value.trim(), position: P.comboValue('reg-position'),
      username: $('reg-username').value.trim(), email: $('reg-email').value.trim(),
      affiliation: P.comboValue('reg-affiliation'), workgroup: $('reg-workgroup').value,
      reason: $('reg-reason').value.trim(), website: $('reg-website').value
    };
    var main = P.isMainAffiliation(d.affiliation);
    if (!main) d.workgroup = '';
    if (!d.fullName || !d.username || !d.email || !d.affiliation || (main && !d.workgroup)) {
      return P.setAlert('reg-alert', 'กรุณากรอกช่องที่มี * ให้ครบ');
    }
    if (/\s/.test(d.username) || d.username.length < 3) return P.setAlert('reg-alert', 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร และห้ามมีช่องว่าง');
    if (!P.emailOk(d.email)) return P.setAlert('reg-alert', 'รูปแบบอีเมลไม่ถูกต้อง');
    var btn = $('btn-register'); P.busy(btn, true, 'กำลังส่งคำขอ...');
    P.api('public.register', d).then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('reg-alert', res.message);
      $('reg-fields').hidden = true;
      P.setAlert('reg-alert', res.message + ' (เลขคำขอ ' + res.requestId + ')', true);
    });
  });
  $('btn-reg-back').addEventListener('click', function () { backToLogin(); });

  // ---------- ลืมรหัสผ่าน ----------
  function setStep(n) {
    $('fg-step1').hidden = n !== 1;
    $('fg-step2').hidden = n !== 2;
    $('fg-username').readOnly = n === 2;
  }
  function openForgot(username) {
    P.show('view-forgot');
    P.setAlert('fg-alert', '');
    ['fg-email', 'fg-code', 'fg-new', 'fg-confirm'].forEach(function (id) { $(id).value = ''; });
    $('fg-username').value = username || '';
    $('fg-new').dispatchEvent(new Event('input'));
    setStep(1);
    window.scrollTo(0, 0);
    setTimeout(function () { ($('fg-username').value ? $('fg-email') : $('fg-username')).focus(); }, 50);
  }

  function sendCode() {
    var u = $('fg-username').value.trim(), em = $('fg-email').value.trim();
    if (!u || !em) return P.setAlert('fg-alert', 'กรุณากรอกชื่อผู้ใช้และอีเมล');
    if (!P.emailOk(em)) return P.setAlert('fg-alert', 'รูปแบบอีเมลไม่ถูกต้อง');
    var btn = $('btn-fg-send'); P.busy(btn, true, 'กำลังส่ง...');
    P.api('public.forgotRequest', { username: u, email: em }).then(function (res) {
      P.busy(btn, false);
      if (!res.ok) return P.setAlert('fg-alert', res.message);
      P.setAlert('fg-alert', res.message, true);
      setStep(2);
      setTimeout(function () { $('fg-code').focus(); }, 50);
    });
  }

  function resetPw() {
    var code = $('fg-code').value.replace(/\D/g, ''), n = $('fg-new').value, c = $('fg-confirm').value;
    if (code.length !== 6) return P.setAlert('fg-alert', 'กรุณากรอกรหัสยืนยัน 6 หลัก');
    if (!P.rulesOk(n)) return P.setAlert('fg-alert', 'รหัสผ่านใหม่ยังไม่ครบเงื่อนไข');
    if (n !== c) return P.setAlert('fg-alert', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
    var btn = $('btn-fg-reset'); P.busy(btn, true, 'กำลังบันทึก...');
    P.api('public.forgotReset', { username: $('fg-username').value.trim(), code: code, newPassword: n, confirmPassword: c })
      .then(function (res) {
        P.busy(btn, false);
        if (!res.ok) return P.setAlert('fg-alert', res.message);
        var u = $('fg-username').value.trim();
        backToLogin(res.message, true);
        $('login-username').value = u;
        $('login-password').focus();
      });
  }

  $('form-forgot').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('fg-step2').hidden) resetPw(); else sendCode();
  });
  $('btn-fg-resend').addEventListener('click', function () { setStep(1); P.setAlert('fg-alert', ''); $('fg-email').focus(); });
  $('btn-fg-back').addEventListener('click', function () { backToLogin(); });
  P.bindRules('fg-new');

  window.PHC37Public = { openRegister: openRegister, openForgot: openForgot };
})();
