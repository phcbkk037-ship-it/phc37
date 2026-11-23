/* PHC37 PWA — svy-run.js (PHC37-SVY-RUN-1.0.0 · 23 พ.ย. 2569) : ตัวแสดงหน้าตอบแบบสอบถาม (ใช้ร่วม survey.html ประชาชน + svy.html เจ้าหน้าที่)
 * ผู้ใช้ตัดสินใจ 23 พ.ย.: ทีละข้อทีละหน้าจอ · โหมดสดใส/เรียบ · หมอน้อย A/B/D · หน้าอารมณ์ 5 หรือ 3 หน้า + ดาวแบบมีมิติ + ระดับคำ
 *   คะแนนต่ำ = หมอน้อยพยักหน้ารับฟัง + ข้อความ "ขอบคุณที่แสดงความคิดเห็น" (ผู้สร้างตั้งข้อความเองได้) — ไม่ให้ความสนุกบิดคำตอบ
 *   ไม่ใส่เสียง · สั่นเบา ๆ (Android) · ปิดการเคลื่อนไหวเมื่อเครื่องตั้ง "ลดการเคลื่อนไหว"
 * ใช้: SvyRun.mount(กล่อง, ข้อมูลจาก svy.form/svy.pubForm, { submit(payload) → Promise<res>, kiosk, onDone, doneLabel })
 * ข้อความจากผู้สร้างใส่ด้วย textContent เท่านั้น */
(function () {
  'use strict';
  var INK = '#3F2617';
  var BRAND = 'ศบส.37 ประสงค์ - สุดสาคร ตู้จินดา';
  var FACE_L5 = ['ไม่พอใจมาก', 'ไม่พอใจ', 'เฉย ๆ', 'พอใจ', 'พอใจมาก'];
  var FACE_L3 = ['ไม่พอใจ', 'เฉย ๆ', 'พอใจ'];
  var LEVEL_L = ['น้อยที่สุด', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'];
  var REDUCE = false;
  try { REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var gid = 0;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  function html(tag, cls, markup) { var e = el(tag, cls); e.innerHTML = markup; return e; }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ---------- หมอน้อย (ออกแบบเอง) ----------
  function mzEyes(m, dy) {
    dy = dy || 0; var y = 46 + dy;
    if (m === 'happy') return '<g class="sr-eyes"><path d="M37 ' + y + ' Q42 ' + (y - 6) + ' 47 ' + y + ' M53 ' + y + ' Q58 ' + (y - 6) + ' 63 ' + y + '" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/></g>';
    return '<g class="sr-eyes"><ellipse cx="42" cy="' + y + '" rx="3.4" ry="4.4" fill="' + INK + '"/><ellipse cx="58" cy="' + y + '" rx="3.4" ry="4.4" fill="' + INK + '"/><circle cx="43.3" cy="' + (y - 1.7) + '" r="1.3" fill="#fff"/><circle cx="59.3" cy="' + (y - 1.7) + '" r="1.3" fill="#fff"/></g>';
  }
  function mzMouth(m) {
    if (m === 'happy') return '<path d="M41 55 Q50 67 59 55Z" fill="' + INK + '"/><ellipse cx="50" cy="61" rx="4.6" ry="2.4" fill="#FF7B7B"/>';
    if (m === 'listen') return '<path d="M45 57 Q50 60 55 57" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    return '<path d="M43 56 Q50 63 57 56" stroke="' + INK + '" stroke-width="2.8" fill="none" stroke-linecap="round"/>';
  }
  function mzCheeks() { return '<ellipse cx="35" cy="54" rx="4.5" ry="2.8" fill="#FF8A8A" opacity=".45"/><ellipse cx="65" cy="54" rx="4.5" ry="2.8" fill="#FF8A8A" opacity=".45"/>'; }
  function mzDefs(id) {
    return '<defs><radialGradient id="sk' + id + '" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE8D3"/><stop offset="1" stop-color="#F0B588"/></radialGradient>' +
      '<linearGradient id="ct' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D8E4DC"/></linearGradient>' +
      '<radialGradient id="ht' + id + '" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#FFB3C4"/><stop offset=".6" stop-color="#FF5C80"/><stop offset="1" stop-color="#C9294F"/></radialGradient>' +
      '<radialGradient id="hl' + id + '"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>';
  }
  function mzSteth(c) { return '<path d="M40 76 Q34 92 44 97" stroke="' + c + '" stroke-width="2.6" fill="none"/><circle cx="45" cy="98" r="3.6" fill="#C9D3DC" stroke="' + c + '" stroke-width="1.6"/>'; }
  function mascotSvg(kind, m) {
    var id = 'm' + (gid++);
    var sh = '<ellipse cx="50" cy="107" rx="26" ry="3" fill="#000" opacity=".1"/>';
    if (kind === 'D') {
      return '<svg viewBox="0 0 100 110" aria-hidden="true">' + mzDefs(id) + '<ellipse cx="50" cy="107" rx="22" ry="3" fill="#000" opacity=".1"/><g class="sr-who">' +
        '<path d="M40 92 L38 104 M60 92 L62 104" stroke="#C9294F" stroke-width="5" stroke-linecap="round"/>' +
        '<g class="sr-arm"><path d="M80 52 Q90 46 88 34" stroke="#FF5C80" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="88" cy="32" r="4.6" fill="#fff" stroke="#E6B8C4"/></g>' +
        '<path d="M20 52 Q10 54 12 66" stroke="#FF5C80" stroke-width="7" stroke-linecap="round" fill="none"/>' +
        '<g class="sr-head sr-breathe"><path d="M50 96 Q14 72 14 44 Q14 22 32 22 Q44 22 50 34 Q56 22 68 22 Q86 22 86 44 Q86 72 50 96Z" fill="url(#ht' + id + ')"/>' +
        '<ellipse cx="32" cy="34" rx="10" ry="6" fill="url(#hl' + id + ')" transform="rotate(-25 32 34)"/><path d="M18 30 Q50 20 82 30" stroke="#9AA7B2" stroke-width="2.4" fill="none"/>' +
        '<circle cx="50" cy="24" r="6" fill="#DDE4EA" stroke="#9AA7B2" stroke-width="1.5"/><circle cx="48.5" cy="22.5" r="1.8" fill="#fff"/>' +
        '<path d="M34 70 Q30 84 40 88" stroke="#2F4B66" stroke-width="2.4" fill="none"/><circle cx="41" cy="88.5" r="3.4" fill="#C9D3DC" stroke="#2F4B66" stroke-width="1.4"/>' +
        mzEyes(m, 4) + '<g transform="translate(0 6)">' + mzMouth(m) + '</g>' +
        '<ellipse cx="33" cy="60" rx="4.5" ry="2.8" fill="#fff" opacity=".35"/><ellipse cx="67" cy="60" rx="4.5" ry="2.8" fill="#fff" opacity=".35"/></g></g></svg>';
    }
    var girl = kind === 'B';
    var coatLine = girl ? '#D9C4CC' : '#B9CBBF', collar = girl ? '#FFB3C4' : '#7FC8A0', sleeve = girl ? '#F3ECEF' : '#E6EEE9';
    var hair = girl
      ? '<circle cx="78" cy="34" r="9" fill="#5A3A2A"/><path d="M75 26 Q86 20 88 30" stroke="#FF8FB1" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : '';
    var hairTop = girl
      ? '<path d="M23 50 Q20 18 50 17 Q80 18 77 50 Q74 34 62 29 Q50 36 34 30 Q26 36 23 50Z" fill="#5A3A2A"/><g transform="translate(36 25)"><rect x="-4" y="-1.4" width="8" height="2.8" rx="1" fill="#FF5C80"/><rect x="-1.4" y="-4" width="2.8" height="8" rx="1" fill="#FF5C80"/></g>'
      : '<path d="M24 42 Q25 16 50 16 Q75 16 76 42 Q70 28 50 27 Q32 27 24 42Z" fill="#3B2A20"/><circle cx="50" cy="26" r="7" fill="#DDE4EA" stroke="#9AA7B2" stroke-width="1.6"/><circle cx="48" cy="24" r="2" fill="#fff"/>';
    return '<svg viewBox="0 0 100 110" aria-hidden="true">' + mzDefs(id) + sh + '<g class="sr-who"><g class="sr-breathe">' +
      '<path d="M24 106 Q24 78 50 74 Q76 78 76 106Z" fill="url(#ct' + id + ')" stroke="' + coatLine + '"/><path d="M43 75 L50 88 L57 75" fill="' + collar + '"/>' +
      '<line x1="50" y1="88" x2="50" y2="106" stroke="' + coatLine + '"/>' + mzSteth(girl ? '#D4537E' : '#2F4B66') +
      (girl ? '' : '<rect x="58" y="90" width="9" height="7" rx="1.5" fill="#E9F2EC" stroke="#B9CBBF"/>') + '</g>' +
      '<g class="sr-arm"><path d="M72 84 Q84 74 82 60" stroke="' + sleeve + '" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="82" cy="58" r="5.2" fill="#F2C29A"/></g>' +
      '<g class="sr-head">' + hair + '<circle cx="50" cy="46" r="26" fill="url(#sk' + id + ')"/>' + hairTop + mzCheeks() + mzEyes(m) + mzMouth(m) + '</g></g></svg>';
  }

  // ---------- หน้าอารมณ์ / ดาว (มีมิติ) ----------
  var FC = { 1: ['#FF8A7A', '#E53935', '#A61B1B'], 2: ['#FFB570', '#F57C1F', '#B4500C'], 3: ['#FFE680', '#F5C518', '#B8860B'], 4: ['#C8F07A', '#8BC34A', '#4E7F1E'], 5: ['#7EE08F', '#2EAD4B', '#17702C'] };
  function faceSvg(s) {
    var id = 'f' + (gid++), c = FC[s], l = c[0], m = c[1], d = c[2], brow = '', mouth = '', extra = '';
    if (s === 1) { brow = '<path d="M17 20 L25 24 M47 20 L39 24" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'; mouth = '<path d="M21 48 Q32 36 43 48 Q32 44 21 48Z" fill="' + INK + '"/>'; }
    if (s === 2) { brow = '<path d="M18 21 Q22 19 26 21 M38 21 Q42 19 46 21" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>'; mouth = '<path d="M22 46 Q32 39 42 46" stroke="' + INK + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>'; }
    if (s === 3) mouth = '<path d="M23 44 L41 44" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>';
    if (s === 4) { mouth = '<path d="M21 40 Q32 51 43 40" stroke="' + INK + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>'; extra = '<ellipse cx="17" cy="38" rx="5" ry="3" fill="#FF6F6F" opacity=".35"/><ellipse cx="47" cy="38" rx="5" ry="3" fill="#FF6F6F" opacity=".35"/>'; }
    if (s === 5) { mouth = '<path d="M19 37 Q32 37 45 37 Q44 53 32 54 Q20 53 19 37Z" fill="' + INK + '"/><path d="M21 38 L43 38 Q43 41 41 42 L23 42 Q21 41 21 38Z" fill="#fff"/><ellipse cx="32" cy="49" rx="7" ry="4" fill="#FF6B6B"/>'; extra = '<ellipse cx="15" cy="38" rx="5" ry="3" fill="#FF6F6F" opacity=".4"/><ellipse cx="49" cy="38" rx="5" ry="3" fill="#FF6F6F" opacity=".4"/>'; }
    var eyes = s === 5 ? '<path d="M17 28 Q22 21 27 28 M37 28 Q42 21 47 28" stroke="' + INK + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="22" cy="29" rx="3.6" ry="4.6" fill="' + INK + '"/><ellipse cx="42" cy="29" rx="3.6" ry="4.6" fill="' + INK + '"/><circle cx="23.3" cy="27.4" r="1.4" fill="#fff"/><circle cx="43.3" cy="27.4" r="1.4" fill="#fff"/>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="' + id + '" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="' + l + '"/><stop offset=".6" stop-color="' + m + '"/><stop offset="1" stop-color="' + d + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'h"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="32" cy="61" rx="18" ry="2.5" fill="#000" opacity=".12"/><circle cx="32" cy="32" r="27" fill="url(#' + id + ')"/>' +
      '<ellipse cx="23" cy="15" rx="11" ry="6" fill="url(#' + id + 'h)" transform="rotate(-20 23 15)"/>' + extra + brow + eyes + mouth + '</svg>';
  }
  var SP = 'M32 4 L40.2 22.6 L60.4 24.6 L45.2 38.2 L49.6 58.2 L32 47.8 L14.4 58.2 L18.8 38.2 L3.6 24.6 L23.8 22.6Z';
  function starSvg() {
    var id = 's' + (gid++);
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="' + id + '" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".45" stop-color="#FFC824"/><stop offset="1" stop-color="#D98A00"/></radialGradient>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F2F2"/><stop offset="1" stop-color="#CFCFCF"/></linearGradient><clipPath id="' + id + 'c"><path d="' + SP + '"/></clipPath></defs>' +
      '<ellipse cx="32" cy="61" rx="16" ry="2.2" fill="#000" opacity=".1"/><path d="' + SP + '" fill="url(#' + id + 'b)" stroke="#BDBDBD" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<g class="sr-fill"><path d="' + SP + '" fill="url(#' + id + ')" stroke="#C77E00" stroke-width="1.5" stroke-linejoin="round"/><path d="M32 10 L37.5 23 L32 30 L26.5 23Z" fill="#fff" opacity=".45"/>' +
      '<g clip-path="url(#' + id + 'c)"><rect class="sr-shine" x="10" y="-10" width="10" height="90" fill="#fff" opacity=".55" transform="rotate(25 32 32)"/></g></g></svg>';
  }
  function plantSvg(p) {
    var h = 6 + Math.round(p * 26), lv = p >= 0.34, lv2 = p >= 0.67, fl = p >= 1, top = 34 - h;
    return '<svg viewBox="0 0 46 46" aria-hidden="true"><path d="M12 36 L34 36 L31 45 L15 45Z" fill="#C8763E"/><rect x="10" y="33" width="26" height="4" rx="2" fill="#A85F2E"/>' +
      '<path d="M23 34 L23 ' + top + '" stroke="#3DA852" stroke-width="2.6" stroke-linecap="round"/>' +
      (lv ? '<path d="M23 28 Q15 24 14 18 Q21 19 23 26" fill="#5CC46F"/>' : '') + (lv2 ? '<path d="M23 22 Q31 18 33 12 Q25 13 23 20" fill="#5CC46F"/>' : '') +
      (fl ? '<g transform="translate(23 ' + top + ')"><circle r="3" cx="0" cy="-4" fill="#FF8FB1"/><circle r="3" cx="4" cy="0" fill="#FF8FB1"/><circle r="3" cx="0" cy="4" fill="#FF8FB1"/><circle r="3" cx="-4" cy="0" fill="#FF8FB1"/><circle r="2.6" fill="#FFD43B"/></g>'
        : '<circle cx="23" cy="' + top + '" r="2.2" fill="#8FD49B"/>') + '</svg>';
  }

  // ---------- เอฟเฟกต์ ----------
  var PC = { '❤': '#FF5A7A', '✦': '#F5C518', '💧': '#4FA3E0' };
  function burst(host, s, cx, cy) {
    if (REDUCE) return;
    var ring = el('div', 'sr-ring'); ring.style.borderColor = FC[s][1]; ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
    host.appendChild(ring); setTimeout(function () { ring.remove(); }, 700);
    var set = s === 5 ? ['❤', '✦', '❤', '✦', '❤', '✦', '❤', '✦'] : (s === 4 ? ['✦', '✦', '✦', '✦'] : (s === 1 ? ['💧', '💧', '💧'] : []));
    set.forEach(function (ch, i) {
      var e = el('span', 'sr-pt', ch); e.style.color = PC[ch];
      var a = s === 1 ? (Math.PI / 2 + (i - 1) * 0.4) : (i / set.length) * Math.PI * 2, dist = s === 1 ? 34 : 44;
      e.style.left = (cx - 6) + 'px'; e.style.top = (cy - 8) + 'px';
      e.style.setProperty('--x', Math.round(Math.cos(a) * dist) + 'px');
      e.style.setProperty('--y', Math.round(Math.sin(a) * dist - (s === 1 ? 0 : 10)) + 'px');
      e.style.setProperty('--r', Math.round(Math.random() * 90 - 45) + 'deg');
      host.appendChild(e); setTimeout(function () { e.remove(); }, 950);
    });
  }
  function rain(host, cx) {
    if (REDUCE) return;
    var c = html('div', 'sr-cloud', '<svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true"><path d="M8 18 Q1 18 2 12 Q3 7 9 8 Q11 2 17 3 Q24 3 24 9 Q29 9 28 14 Q27 18 22 18Z" fill="#B7C7D4"/></svg>');
    c.style.left = (cx - 15) + 'px'; host.appendChild(c); setTimeout(function () { c.remove(); }, 1700);
    for (var k = 0; k < 4; k++) (function (k) {
      setTimeout(function () { var d = el('div', 'sr-drop'); d.style.left = (cx - 8 + k * 5) + 'px'; d.style.top = '18px'; host.appendChild(d); setTimeout(function () { d.remove(); }, 750); }, 300 + k * 150);
    })(k);
  }
  function confetti(host) {
    if (REDUCE) return;
    var C = ['#3DA852', '#FFC824', '#FF8FB1', '#4FA3E0', '#F57C1F'], w = host.clientWidth || 360;
    for (var k = 0; k < 44; k++) {
      var e = el('div', 'sr-conf'); e.style.left = Math.round(Math.random() * w) + 'px'; e.style.background = C[k % 5];
      e.style.animationDuration = (1.6 + Math.random() * 1.4).toFixed(2) + 's'; e.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      host.appendChild(e);
      (function (e) { setTimeout(function () { e.remove(); }, 3800); })(e);
    }
  }

  // ---------- ตัวแสดงหลัก ----------
  function mount(root, form, opt) {
    opt = opt || {};
    var S = form.survey || {}, QS = (form.questions || []);
    var fun = S.mode !== 'plain', mascot = S.mascot === 'B' || S.mascot === 'D' ? S.mascot : 'A';
    var R = S.reactions || {};
    var st = { i: 0, ans: {}, age: '', sending: false, timer: null, kioskTimer: null };
    // ขั้น: แนะนำ → (อายุ) → คำถาม (หัวข้อส่วนติดไปกับข้อถัดไป) → ส่ง → จบ
    var steps = [{ t: 'intro' }];
    if (S.askAge) steps.push({ t: 'age' });
    var sec = '';
    QS.forEach(function (q) { if (q.kind === 'section') { sec = q.title; return; } steps.push({ t: 'q', q: q, sec: sec }); });
    steps.push({ t: 'send' }); steps.push({ t: 'end' });
    var nAsk = steps.filter(function (x) { return x.t === 'q' || x.t === 'age'; }).length;

    root.textContent = '';
    var wrap = el('div', 'sr ' + (fun ? 'sr-fun' : 'sr-plain'));
    var top = el('div', 'sr-top');
    top.appendChild(el('div', 'sr-lg', '37'));
    var tt = el('div', 'sr-tt'); tt.appendChild(el('b', null, S.title || 'แบบสอบถาม')); tt.appendChild(el('span', null, BRAND)); top.appendChild(tt);
    var bk = el('button', 'sr-bk', '←'); bk.type = 'button'; bk.setAttribute('aria-label', 'ย้อนกลับ'); top.appendChild(bk);
    var prog = el('div'), stage = el('div', 'sr-stage');
    wrap.appendChild(top); wrap.appendChild(prog); wrap.appendChild(stage);
    root.appendChild(wrap);
    bk.addEventListener('click', function () {
      clearTimeout(st.timer);
      if (st.sending) return;
      if (st.i > 0 && steps[st.i].t !== 'end') { st.i--; render(); }
    });

    function mz(mood, text) {
      if (!fun) return text ? el('p', 'sr-qs', text) : el('div');
      var box = el('div', 'sr-mz');
      var w = html('div', 'sr-m-' + mood + (mascot === 'D' ? ' sr-heart' : ''), mascotSvg(mascot, mood === 'happy' ? 'happy' : (mood === 'listen' ? 'listen' : 'hi')));
      box.appendChild(w);
      if (text) box.appendChild(el('div', 'sr-bub', text));
      return box;
    }
    function reactFor(q, v) {
      var max = q.style === 'face3' ? 3 : 5;
      if ((max === 5 && v >= 4) || (max === 3 && v === 3)) return { mood: 'happy', text: R.hi || 'เย้! ขอบคุณมากนะคะ' };
      if ((max === 5 && v === 3) || (max === 3 && v === 2)) return { mood: 'listen', text: R.mid || 'ขอบคุณที่แสดงความคิดเห็นค่ะ' };
      return { mood: 'listen', text: R.lo || 'ขอบคุณที่แสดงความคิดเห็นค่ะ เราจะนำไปปรับปรุง' };
    }
    function next() { clearTimeout(st.timer); if (st.i < steps.length - 1) { st.i++; render(); } }
    function later(ms) { clearTimeout(st.timer); st.timer = setTimeout(next, ms); }
    function progress() {
      var step = steps[st.i];
      prog.textContent = '';
      if (step.t === 'intro') return;
      var done = 0;
      for (var k = 0; k < st.i; k++) if (steps[k].t === 'q' || steps[k].t === 'age') done++;
      var p = step.t === 'end' ? 1 : (nAsk ? done / nAsk : 1), left = nAsk - done;
      if (fun) {
        var b = el('div', 'sr-prog'); b.innerHTML = plantSvg(p);
        b.appendChild(el('div', 'sr-prog-t', step.t === 'end' ? 'ครบแล้ว ต้นกล้าออกดอกแล้ว!' : (step.t === 'send' ? 'ตอบครบแล้ว เหลือแค่กดส่ง' : (left <= 1 ? 'ข้อสุดท้ายแล้ว!' : 'อีก ' + left + ' ข้อก็เสร็จแล้ว'))));
        prog.appendChild(b);
      } else {
        var bar = el('div', 'sr-bar'), i = el('i'); i.style.width = Math.round(p * 100) + '%'; bar.appendChild(i); prog.appendChild(bar);
      }
    }
    function card() { var c = el('div', 'sr-card'); stage.textContent = ''; stage.appendChild(c); return c; }
    function title(c, step) {
      if (step.sec) c.appendChild(el('p', 'sr-sec', step.sec));
      var h = el('p', 'sr-q', step.q.title);
      if (step.q.required) { var r = el('span', 'sr-req', ' *'); r.setAttribute('aria-label', 'ข้อบังคับ'); h.appendChild(r); }
      c.appendChild(h);
      c.appendChild(el('p', 'sr-qs', step.q.help || hint(step.q)));
    }
    function hint(q) {
      if (q.kind === 'rating') return q.style === 'star' ? 'แตะดาว 1–5 ดวง' : (q.style === 'words' ? 'เลือก 1 ระดับ' : 'แตะหน้าที่ตรงกับความรู้สึก');
      if (q.kind === 'single') return 'เลือก 1 ข้อ';
      if (q.kind === 'multi') return 'เลือกได้หลายข้อ';
      if (q.kind === 'yesno') return 'เลือก 1 ข้อ';
      if (q.kind === 'text') return q.required ? 'พิมพ์คำตอบ' : 'ไม่บังคับ ข้ามได้';
      return '';
    }
    function skipBtn(c, q) {
      if (q.required) return;
      var s = el('button', 'sr-skip', 'ข้ามข้อนี้'); s.type = 'button';
      s.addEventListener('click', function () { delete st.ans[q.id]; next(); }); c.appendChild(s);
    }

    function render() {
      clearTimeout(st.timer); clearTimeout(st.kioskTimer);
      var step = steps[st.i];
      bk.hidden = step.t === 'intro' || step.t === 'end';
      progress();
      var c = card();
      try { wrap.scrollIntoView({ block: 'start' }); } catch (e) {}
      if (step.t === 'intro') return rIntro(c);
      if (step.t === 'age') return rAge(c);
      if (step.t === 'send') return rSend(c);
      if (step.t === 'end') return rEnd(c);
      var q = step.q;
      title(c, step);
      if (q.kind === 'rating') { if (q.style === 'star') rStars(c, q); else if (q.style === 'words') rWords(c, q); else rFaces(c, q); }
      else if (q.kind === 'single' || q.kind === 'multi') rChoice(c, q);
      else if (q.kind === 'yesno') rYesNo(c, q);
      else if (q.kind === 'text') rText(c, q);
    }
    function rIntro(c) {
      var nMin = Math.max(1, Math.ceil(nAsk * 0.25));
      c.appendChild(el('p', 'sr-q', fun ? 'สวัสดีค่ะ หมอน้อยขอเวลาแค่ ' + nMin + ' นาทีนะคะ' : (S.title || 'แบบสอบถาม')));
      if (fun) c.appendChild(el('p', 'sr-qs', S.title || ''));
      if (S.description) c.appendChild(el('p', 'sr-qs sr-desc', S.description));
      if (S.channel === 'public') c.appendChild(el('div', 'sr-note', 'ไม่ถามชื่อ เลขบัตรประชาชน หรือเบอร์โทร เก็บแค่อายุเพื่อดูภาพรวม'));
      else if (S.identity === 'named') c.appendChild(el('div', 'sr-note', 'แบบระบุตัวตน — ผู้สร้างแบบสอบถามเห็นว่าใครตอบอะไร'));
      else {
        c.appendChild(el('div', 'sr-note', 'แบบไม่ระบุตัวตน — ระบบจำแค่ว่าคุณตอบแล้ว ไม่ผูกชื่อกับคำตอบ'));
        if (S.breakdown) c.appendChild(el('div', 'sr-warn', 'ผลจะสรุปแยกรายกลุ่มงาน กลุ่มที่มีคนน้อยอาจทำให้รู้ได้ว่าใครตอบ'));
      }
      c.appendChild(mz('hi', fun ? 'มาช่วยหมอน้อยปรับปรุงบริการกันนะ' : ''));
      var go = el('button', 'sr-go', 'เริ่มเลย'); go.type = 'button'; go.addEventListener('click', next); c.appendChild(go);
    }
    function rAge(c) {
      c.appendChild(el('p', 'sr-q', fun ? 'ปีนี้อายุเท่าไหร่คะ?' : 'อายุ (ปี)'));
      c.appendChild(el('p', 'sr-qs', 'กรอกเป็นตัวเลข'));
      var row = el('div', 'sr-age');
      var mi = el('button', null, '−'), inp = el('input'), pl = el('button', null, '+');
      mi.type = pl.type = 'button'; mi.setAttribute('aria-label', 'ลดอายุ'); pl.setAttribute('aria-label', 'เพิ่มอายุ');
      inp.inputMode = 'numeric'; inp.value = st.age; inp.placeholder = '0'; inp.setAttribute('aria-label', 'อายุ (ปี)');
      row.appendChild(mi); row.appendChild(inp); row.appendChild(pl); c.appendChild(row);
      var err = el('div', 'sr-err'); c.appendChild(err);
      function set(v) { v = Math.max(1, Math.min(120, v)); inp.value = v; st.age = v; err.textContent = ''; }
      mi.addEventListener('click', function () { set((+inp.value || 31) - 1); });
      pl.addEventListener('click', function () { set((+inp.value || 29) + 1); });
      inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 3); st.age = inp.value; err.textContent = ''; });
      c.appendChild(mz('hi', ''));
      var go = el('button', 'sr-go', 'ถัดไป'); go.type = 'button'; c.appendChild(go);
      function ok() { var v = +inp.value; if (!inp.value || v < 1 || v > 120) { err.textContent = 'กรอกอายุเป็นตัวเลข 1–120'; inp.focus(); return; } st.age = v; next(); }
      go.addEventListener('click', ok);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    }
    function afterRating(c, q, v) {
      st.ans[q.id] = v;
      var r = reactFor(q, v), box = c.querySelector('.sr-mzbox');
      if (fun && box) { box.textContent = ''; box.appendChild(mz(r.mood, r.text)); }
      later(fun ? 1500 : 450);
    }
    function rFaces(c, q) {
      var n3 = q.style === 'face3', vals = n3 ? [1, 2, 3] : [1, 2, 3, 4, 5];
      var row = el('div', 'sr-faces' + (n3 ? ' sr-n3' : '')); c.appendChild(row);
      vals.forEach(function (v) {
        var s = n3 ? [1, 3, 5][v - 1] : v, lab = (n3 ? FACE_L3 : FACE_L5)[v - 1];
        var b = el('button', 'sr-f' + (st.ans[q.id] === v ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-label', lab);
        b.innerHTML = faceSvg(s); b.appendChild(el('span', null, lab));
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(row.children, function (x) { x.classList.remove('on'); });
          void b.offsetWidth; b.classList.add('on'); row.classList.add('sr-dim');
          if (fun) { var rb = row.getBoundingClientRect(), bb = b.getBoundingClientRect(); burst(row, s, bb.left - rb.left + bb.width / 2, bb.top - rb.top + 30); }
          vibrate(s === 5 ? [20, 40, 20] : 15);
          afterRating(c, q, v);
        });
        row.appendChild(b);
      });
      if (st.ans[q.id]) row.classList.add('sr-dim');
      c.appendChild(el('div', 'sr-mzbox')).appendChild(mz('hi', ''));
      skipBtn(c, q);
    }
    function rStars(c, q) {
      var row = el('div', 'sr-stars'); c.appendChild(row);
      var lab = el('div', 'sr-st-lab', st.ans[q.id] ? LEVEL_L[st.ans[q.id] - 1] : ''); c.appendChild(lab);
      for (var i = 1; i <= 5; i++) (function (i) {
        var b = el('button', 'sr-st' + (st.ans[q.id] >= i ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-label', i + ' ดาว · ' + LEVEL_L[i - 1]);
        b.innerHTML = starSvg();
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(row.children, function (x, k) {
            if (!x.classList || !x.classList.contains('sr-st')) return;
            x.classList.remove('on', 'sad'); void x.offsetWidth;
            if (k < i) { x.style.setProperty('--d', (k * 0.08) + 's'); x.classList.add('on'); if (i <= 2) x.classList.add('sad'); }
          });
          lab.textContent = LEVEL_L[i - 1];
          if (fun) {
            var hb = row.getBoundingClientRect(), bb = b.getBoundingClientRect(), cx = bb.left - hb.left + bb.width / 2;
            if (i <= 2) rain(row, cx); else setTimeout(function () { burst(row, i, cx, bb.top - hb.top + bb.height / 2); }, i * 80);
          }
          vibrate(15);
          afterRating(c, q, i);
        });
        row.appendChild(b);
      })(i);
      c.appendChild(el('div', 'sr-mzbox')).appendChild(mz('hi', ''));
      skipBtn(c, q);
    }
    function rWords(c, q) {
      var box = el('div', 'sr-chips sr-one'); c.appendChild(box);
      [5, 4, 3, 2, 1].forEach(function (v) {
        var b = el('button', 'sr-chip' + (st.ans[q.id] === v ? ' on' : '')); b.type = 'button';
        b.appendChild(el('span', null, LEVEL_L[v - 1]));
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); }); b.classList.add('on'); vibrate(15);
          afterRating(c, q, v);
        });
        box.appendChild(b);
      });
      c.appendChild(el('div', 'sr-mzbox')).appendChild(mz('hi', ''));
      skipBtn(c, q);
    }
    function rChoice(c, q) {
      var multi = q.kind === 'multi', opts = q.options || [];
      var long = opts.some(function (o) { return String(o.label).length > 16; });
      var box = el('div', 'sr-chips' + (long || opts.length < 3 ? ' sr-one' : '')); c.appendChild(box);
      var cur = multi ? (st.ans[q.id] || []).slice() : st.ans[q.id];
      var go = null;
      opts.forEach(function (o, k) {
        var on = multi ? cur.indexOf(k) >= 0 : cur === k;
        var b = el('button', 'sr-chip' + (on ? ' on' : '')); b.type = 'button';
        if (multi) b.appendChild(el('span', 'sr-box', on ? '✓' : ''));
        if (o.icon) b.appendChild(el('span', 'sr-ic', o.icon));
        b.appendChild(el('span', null, o.label));
        b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', function () {
          vibrate(12);
          if (multi) {
            var at = cur.indexOf(k);
            if (at >= 0) cur.splice(at, 1); else cur.push(k);
            var now = cur.indexOf(k) >= 0; b.classList.toggle('on', now); b.setAttribute('aria-pressed', String(now));
            b.querySelector('.sr-box').textContent = now ? '✓' : '';
            go.disabled = q.required && !cur.length;
            return;
          }
          Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
          b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
          st.ans[q.id] = k;
          var mb = c.querySelector('.sr-mzbox'); if (fun && mb) { mb.textContent = ''; mb.appendChild(mz('happy', 'รับทราบค่ะ')); }
          later(fun ? 900 : 350);
        });
        box.appendChild(b);
      });
      c.appendChild(el('div', 'sr-mzbox')).appendChild(mz('hi', ''));
      if (multi) {
        go = el('button', 'sr-go', 'ถัดไป'); go.type = 'button'; go.disabled = q.required && !cur.length;
        go.addEventListener('click', function () { if (cur.length) st.ans[q.id] = cur.slice().sort(); else delete st.ans[q.id]; next(); });
        c.appendChild(go);
      }
      skipBtn(c, q);
    }
    function rYesNo(c, q) {
      var box = el('div', 'sr-yn'); c.appendChild(box);
      [[1, '👍', 'ใช่'], [0, '👎', 'ไม่ใช่']].forEach(function (x) {
        var b = el('button', 'sr-chip' + (st.ans[q.id] === x[0] ? ' on' : '')); b.type = 'button';
        b.appendChild(el('span', 'sr-ic', x[1])); b.appendChild(el('span', null, x[2]));
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(box.children, function (y) { y.classList.remove('on'); }); b.classList.add('on'); vibrate(12);
          st.ans[q.id] = x[0];
          var mb = c.querySelector('.sr-mzbox'); if (fun && mb) { mb.textContent = ''; mb.appendChild(mz('happy', 'รับทราบค่ะ')); }
          later(fun ? 900 : 350);
        });
        box.appendChild(b);
      });
      c.appendChild(el('div', 'sr-mzbox')).appendChild(mz('hi', ''));
      skipBtn(c, q);
    }
    function rText(c, q) {
      var ta = el('textarea', 'sr-ta'); ta.maxLength = 1000; ta.placeholder = 'พิมพ์ความเห็นตรงนี้'; ta.value = st.ans[q.id] || '';
      ta.setAttribute('aria-label', q.title); c.appendChild(ta);
      c.appendChild(el('div', 'sr-warn', 'อย่าใส่ชื่อ เบอร์โทร หรือเลขบัตรประชาชนนะคะ'));
      var err = el('div', 'sr-err'); c.appendChild(err);
      var go = el('button', 'sr-go', 'ถัดไป'); go.type = 'button'; c.appendChild(go);
      ta.addEventListener('input', function () { err.textContent = ''; });
      go.addEventListener('click', function () {
        var v = ta.value.trim();
        if (!v && q.required) { err.textContent = 'กรุณาพิมพ์คำตอบ'; ta.focus(); return; }
        if (v) st.ans[q.id] = v; else delete st.ans[q.id];
        next();
      });
      skipBtn(c, q);
    }
    function missing() {
      for (var k = 0; k < steps.length; k++) {
        var s = steps[k];
        if (s.t === 'age' && !(st.age >= 1 && st.age <= 120)) return k;
        if (s.t === 'q' && s.q.required) {
          var v = st.ans[s.q.id];
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return k;
        }
      }
      return -1;
    }
    function rSend(c) {
      c.appendChild(el('p', 'sr-q', fun ? 'เย้! ตอบครบแล้ว' : 'ตอบครบแล้ว'));
      c.appendChild(el('p', 'sr-qs', 'ตรวจคำตอบได้ด้วยปุ่มย้อนกลับ ถ้าพร้อมแล้วกดส่งได้เลย'));
      c.appendChild(mz('happy', fun ? 'ขอบคุณที่ช่วยหมอน้อยนะคะ' : ''));
      var err = el('div', 'sr-err'); c.appendChild(err);
      var go = el('button', 'sr-go', 'ส่งแบบสอบถาม'); go.type = 'button'; c.appendChild(go);
      go.addEventListener('click', function () {
        var m = missing();
        if (m >= 0) { st.i = m; render(); return; }
        st.sending = true; go.disabled = true; go.textContent = 'กำลังส่ง…'; err.textContent = '';
        var payload = { answers: st.ans };
        if (S.askAge) payload.age = +st.age;
        Promise.resolve(opt.submit ? opt.submit(payload) : { ok: true }).then(function (res) {
          st.sending = false;
          if (res && res.ok) { st.i = steps.length - 1; render(); return; }
          if (res && res.code === 'already') { st.i = steps.length - 1; st.already = true; render(); return; }
          go.disabled = false; go.textContent = 'ลองส่งอีกครั้ง';
          err.textContent = (res && res.message) || 'ส่งไม่สำเร็จ กรุณาลองใหม่';
        }, function () {
          st.sending = false; go.disabled = false; go.textContent = 'ลองส่งอีกครั้ง';
          err.textContent = 'เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วกดส่งอีกครั้ง (คำตอบยังอยู่ครบ)';
        });
      });
    }
    function rEnd(c) {
      c.classList.add('sr-end');
      c.appendChild(el('p', 'sr-q', st.already ? 'คุณตอบแบบสอบถามนี้แล้ว' : (fun ? 'ขอบคุณมากนะคะ!' : 'ส่งแบบสอบถามแล้ว ขอบคุณค่ะ')));
      c.appendChild(el('p', 'sr-qs', 'ความเห็นของคุณช่วยให้ ศบส.37 ดีขึ้นทุกวัน'));
      if (fun) c.appendChild(mz('happy', '')); else c.appendChild(el('div', 'sr-big-ok', '✓'));
      if (opt.kiosk) {
        var again = el('button', 'sr-go', 'ให้คนถัดไปตอบ'); again.type = 'button'; c.appendChild(again);
        var cnt = el('div', 'sr-count'); c.appendChild(cnt);
        var left = 20;
        var tick = function () { cnt.textContent = 'กลับหน้าแรกอัตโนมัติใน ' + left + ' วินาที'; if (left-- <= 0) restart(); else st.kioskTimer = setTimeout(tick, 1000); };
        tick();
        again.addEventListener('click', restart);
      }
      if (opt.onDone) {
        var b = el('button', 'sr-go' + (opt.kiosk ? ' sr-ghost' : ''), opt.doneLabel || 'กลับ'); b.type = 'button';
        b.addEventListener('click', function () { clearTimeout(st.kioskTimer); opt.onDone(); }); c.appendChild(b);
      }
      if (fun && !st.already) confetti(wrap);
      vibrate([20, 40, 20]);
    }
    function restart() { clearTimeout(st.kioskTimer); st.i = 0; st.ans = {}; st.age = ''; st.already = false; render(); }
    render();
    return { restart: restart, destroy: function () { clearTimeout(st.timer); clearTimeout(st.kioskTimer); root.textContent = ''; } };
  }

  window.SvyRun = { mount: mount, mascotSvg: mascotSvg, faceSvg: faceSvg, starSvg: starSvg, VERSION: 'PHC37-SVY-RUN-1.0.0' };
})();
