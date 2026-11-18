/* PHC37 PWA — tasks.js (PHC37-PWA-TASKS-1.2.0) : งานบุคคล — กล่องงาน · รายละเอียด · มอบหมาย · ตรวจรับ · แจ้งเตือน */
(function () {
  'use strict';
  var P = window.PHC37;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function chip(text, kind) { return el('span', 'chip ' + (kind || ''), text); }
  function call(action, data) { data = data || {}; data.token = P.token(); return P.api(action, data); }
  function quiet(action, data) { data = data || {}; data.token = P.token(); return P.api(action, data, { quiet: true }); }
  function openDlg(d) { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }
  function guard(res) {
    if (res && !res.ok && res.code === 'unauthorized') { P.showLogin(res.message); return false; }
    return true;
  }

  var ST_LABEL = {
    assigned: ['งานใหม่ รอรับ', 'info'], accepted: ['รับงานแล้ว', 'ok'], in_progress: ['กำลังดำเนินการ', 'ok'],
    submitted: ['ส่งผลแล้ว รอตรวจ', 'warn'], returned: ['ส่งกลับแก้ไข', 'danger'], approved: ['ตรวจรับแล้ว', 'ok'],
    rejected: ['ปฏิเสธงาน', ''], cancelled: ['ยกเลิก', '']
  };
  var TASK_ST = { open: ['กำลังดำเนินการ', 'info'], done: ['ปิดงานแล้ว', 'ok'], cancelled: ['ยกเลิกแล้ว', ''] };
  var PRIO = { urgent: ['ด่วน', 'warn'], very_urgent: ['ด่วนมาก', 'danger'] };
  var EV_LABEL = {
    create: '📝 มอบหมายงาน', accept: '✋ รับงาน', reject: '🚫 ปฏิเสธงาน', progress: '⏳ ความคืบหน้า', submit: '📤 ส่งผลงาน',
    approve: '✅ ตรวจรับ', 'return': '↩️ ส่งกลับแก้ไข', cancel: '🛑 ยกเลิกงาน'
  };
  var NF_ICON = { assigned: '📝', accepted: '✋', rejected: '🚫', submitted: '📤', approved: '✅', returned: '↩️', cancelled: '🛑', due_soon: '⏰', overdue: '⚠️' };
  var ASSIGNEE_BOX = { todo: 1, sent: 1, done: 1 };

  var S = { box: 'todo', summary: null, sumAt: 0, opts: null, cur: null };

  // ---------- กำหนดส่ง ----------
  function dueInfo(due, closed) {
    if (!due) return null;
    var ms = new Date(due).getTime() - Date.now();
    var txt = 'กำหนดส่ง ' + P.fmtTime(due);
    if (closed) return [txt, ''];
    if (ms < 0) return ['เลยกำหนด · ' + P.fmtTime(due), 'danger'];
    if (ms < 86400000) return ['ครบกำหนดภายใน 24 ชม. · ' + P.fmtTime(due), 'warn'];
    return [txt + ' (อีก ' + Math.ceil(ms / 86400000) + ' วัน)', ''];
  }

  // ---------- ตัวเลขสรุป (หน้าหลัก · กระดิ่ง · แท็บ) ----------
  function refreshSummary(force) {
    if (!P.token()) return Promise.resolve(null);
    if (!S.summary) { var cs = P.cacheGet('task.summary'); if (cs) { S.summary = cs; renderSummary(); } }
    if (!force && Date.now() - S.sumAt < 30000 && S.summary) { renderSummary(); return Promise.resolve(S.summary); }
    S.sumAt = Date.now();
    return quiet('task.summary').then(function (r) {
      if (!r.ok) return null;
      S.summary = r; P.cacheSet('task.summary', r); renderSummary(); return r;
    });
  }
  function renderSummary() {
    var s = S.summary; if (!s) return;
    var b = $('bell-badge');
    b.hidden = !s.unread; b.textContent = s.unread > 99 ? '99+' : s.unread;
    var parts = [];
    if (s.todo) parts.push('ต้องทำ ' + s.todo + (s.newTasks ? ' (ใหม่ ' + s.newTasks + ')' : ''));
    if (s.overdue) parts.push('เลยกำหนด ' + s.overdue);
    if (s.waiting) parts.push('รอตรวจ ' + s.waiting);
    if (s.toReview) parts.push('ต้องตรวจรับ ' + s.toReview);
    // การ์ดงานของฉันบนหน้าหลัก (แบบ Gateway เดิม)
    var box = $('home-tasks'), pending = (s.todo || 0) + (s.toReview || 0);
    box.hidden = false;
    box.className = 'gw-inbox' + (s.overdue ? ' alert' : (pending ? ' busy' : ''));
    $('home-tasks-ic').textContent = s.overdue ? '⚠️' : (pending ? '📌' : '✅');
    $('home-tasks-title').textContent = pending ? 'มีงานค้าง ' + pending + ' งาน' : 'ไม่มีงานค้าง';
    $('home-tasks-sub').textContent = parts.length ? parts.join(' · ') : 'ตอนนี้ยังไม่มีงานที่ได้รับมอบหมายค้างอยู่';
    var sum = $('home-tasks-sum'); sum.textContent = '';
    [['📌 ต้องทำ', s.todo], ['⏱️ เลยกำหนด', s.overdue], ['🔎 รอตรวจรับ', s.waiting]].concat(s.canAssign ? [['📥 ต้องตรวจรับ', s.toReview]] : [])
      .forEach(function (x) { var b = el('span', 'gw-mini', x[0] + ': '); b.appendChild(el('b', null, String(x[1] || 0))); sum.appendChild(b); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (x) {
      var n = s[x.dataset.count] || 0; x.hidden = !n; x.textContent = n;
    });
    Array.prototype.forEach.call(document.querySelectorAll('#home-tasks [data-assigner]'), function (x) { x.hidden = !s.canAssign; });
    var nb = $('nav-task-badge'); nb.hidden = !s.todo; nb.textContent = s.todo || '';
    var rb = $('nav-review-badge'); rb.hidden = !s.toReview; rb.textContent = s.toReview || '';
    $('nav-assign').hidden = !s.canAssign;
    boxVisibility();
    var prof = P.profile(), sup = prof && prof.user && prof.user.role === 'superadmin';
    $('tk-all-wrap').hidden = !(sup && !ASSIGNEE_BOX[S.box]);
  }

  // ---------- หน้ากล่องงาน ----------
  /** งานของฉัน = กล่องผู้รับ · มอบหมายงาน = กล่องผู้มอบ (แบบเมนูเดิม "งานของฉัน" / "มอบหมายงาน") */
  function boxVisibility() {
    var canAssign = !!(S.summary && S.summary.canAssign), assign = S.mode === 'assign';
    Array.prototype.forEach.call(document.querySelectorAll('#view-tasks .tab'), function (t) {
      t.hidden = assign ? !(t.dataset.assigner && canAssign) : !!t.dataset.assigner;
    });
    $('tk-new').hidden = !(assign && canAssign);
  }
  function open(box, assignMode) {
    S.box = box || 'todo';
    S.mode = assignMode || !ASSIGNEE_BOX[S.box] ? 'assign' : 'mine';
    P.show('view-tasks');
    P.setPage(S.mode === 'assign' ? 'assign' : 'tasks', S.mode === 'assign' ? 'มอบหมายงาน' : 'งานของฉัน');
    $('tk-heading').textContent = S.mode === 'assign' ? '👥 งานบุคคล · มอบหมายงานและติดตามงาน' : '📋 งานของฉัน';
    boxVisibility();
    try { history.pushState({ phc37View: 'tasks' }, ''); } catch (e) {}
    window.scrollTo(0, 0);
    refreshSummary(true);
    switchBox(S.box);
  }
  function switchBox(box) {
    S.box = box;
    Array.prototype.forEach.call(document.querySelectorAll('#view-tasks .tab'), function (t) {
      t.classList.toggle('active', t.dataset.box === box);
    });
    renderSummary();
    loadList();
  }
  function loadList(fresh) {
    var wrap = $('tk-list'), box = S.box, all = $('tk-all').checked;
    P.swr('task.list.' + box + (all ? '.all' : ''), function () { return call('task.list', { box: box, all: all }); }, function (r) {
      if (box !== S.box) return;
      wrap.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) { wrap.appendChild(el('p', 'empty', r.message)); return; }
      if (!r.items.length) {
        wrap.appendChild(el('p', 'empty', {
          todo: '🎉 ไม่มีงานค้าง', sent: 'ยังไม่มีงานที่ส่งผลและรอตรวจรับ', done: 'ยังไม่มีงานที่เสร็จแล้ว',
          assigned: 'ยังไม่มีงานที่มอบหมายและยังเปิดอยู่', review: 'ไม่มีผลงานรอตรวจรับ', closed: 'ยังไม่มีงานที่ปิดแล้ว'
        }[box]));
        return;
      }
      r.items.forEach(function (it) { wrap.appendChild(ASSIGNEE_BOX[box] ? rowMine(it) : rowAssigned(it)); });
    }, function () { P.skeleton(wrap, 4); }, fresh === true);
  }
  function rowBase(it, closed) {
    var row = el('button', 'row tk-row'); row.type = 'button';
    var main = el('span', 'row-main');
    var t = el('span', 'row-title');
    if (PRIO[it.priority]) { t.appendChild(chip(PRIO[it.priority][0], PRIO[it.priority][1])); t.appendChild(document.createTextNode(' ')); }
    t.appendChild(document.createTextNode(it.title));
    main.appendChild(t);
    var di = dueInfo(it.dueAt, closed);
    var sub = el('span', 'row-sub', (it.createdByName ? 'จาก ' + it.createdByName + ' · ' : '') + 'มอบเมื่อ ' + P.fmtTime(it.createdAt, true));
    main.appendChild(sub);
    if (di) main.appendChild(el('span', 'tk-due ' + di[1], '📅 ' + di[0]));
    row.appendChild(main);
    row.addEventListener('click', function () { openTask(it.taskId); });
    return { row: row, main: main };
  }
  function rowMine(it) {
    var closed = it.taskStatus !== 'open' || ['approved', 'rejected', 'cancelled'].indexOf(it.myStatus) >= 0;
    var x = rowBase(it, closed);
    var f = el('span', 'row-flags');
    var st = ST_LABEL[it.myStatus] || [it.myStatus, ''];
    f.appendChild(chip(st[0], st[1]));
    if (it.returnCount) f.appendChild(chip('แก้ไข ' + it.returnCount + ' ครั้ง', ''));
    if (it.sourceApp) f.appendChild(chip('จาก ' + it.sourceApp, 'info'));
    x.main.appendChild(f);
    if (!closed && it.progress > 0) x.main.appendChild(progressBar(it.progress));
    return x.row;
  }
  function rowAssigned(it) {
    var x = rowBase(it, it.taskStatus !== 'open');
    var c = it.counts || {}, f = el('span', 'row-flags');
    var ts = TASK_ST[it.taskStatus] || [it.taskStatus, ''];
    f.appendChild(chip(ts[0], ts[1]));
    var done = (c.approved || 0), sent = (c.submitted || 0);
    f.appendChild(chip('เสร็จ ' + done + '/' + it.total, done === it.total ? 'ok' : ''));
    if (sent) f.appendChild(chip('รอตรวจรับ ' + sent, 'warn'));
    if (c.assigned) f.appendChild(chip('ยังไม่รับ ' + c.assigned, 'info'));
    if (c.returned) f.appendChild(chip('ส่งแก้ ' + c.returned, 'danger'));
    if (c.rejected) f.appendChild(chip('ปฏิเสธ ' + c.rejected, ''));
    if (!it.mine) f.appendChild(chip('มอบโดย ' + (it.createdByName || '-'), ''));
    x.main.appendChild(f);
    if (it.total) x.main.appendChild(progressBar(Math.round(done * 100 / it.total)));
    return x.row;
  }
  function progressBar(p) {
    var w = el('span', 'tk-bar'); var i = el('span', 'tk-bar-in'); i.style.width = Math.max(0, Math.min(100, p)) + '%';
    w.appendChild(i); w.setAttribute('aria-label', 'ความคืบหน้า ' + p + '%'); return w;
  }

  // ---------- ไฟล์แนบ ----------
  var ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
  var MIME_BY_EXT = { pdf: 'application/pdf', doc: 'application/msword', txt: 'text/plain', csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint',
    heic: 'image/heic', heif: 'image/heif' };
  function sizeText(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function readB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  /** ย่อรูปถ่ายจากมือถือ (ด้านยาวไม่เกิน 1600 px · JPEG 82%) ก่อนอัปโหลด */
  function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return Promise.resolve(file);
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return res(file);
          res(new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }
  /** กล่องแนบไฟล์ → { ids(), busy(), reset() } */
  function attachBox(container) {
    container.textContent = '';
    var list = el('div', 'tk-files'), items = [];
    var input = el('input'); input.type = 'file'; input.multiple = true; input.accept = ACCEPT; input.hidden = true;
    var btn = el('button', 'btn btn-ghost btn-sm', '📎 แนบไฟล์ / ถ่ายรูป'); btn.type = 'button';
    btn.addEventListener('click', function () { input.click(); });
    container.appendChild(list); container.appendChild(btn); container.appendChild(input);
    container.appendChild(el('div', 'muted tk-file-note', 'รูปภาพ PDF Word Excel PowerPoint · ไม่เกิน 10 MB ต่อไฟล์ · ครั้งละไม่เกิน 10 ไฟล์'));
    var uploading = 0;
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []); input.value = '';
      files.forEach(function (f) {
        if (items.length >= 10) { P.toast('แนบได้ครั้งละไม่เกิน 10 ไฟล์', 'err'); return; }
        var it = { name: f.name, id: null }; items.push(it);
        var ch = el('span', 'file-chip uploading'); var nm = el('span', null, '⏳ ' + f.name); ch.appendChild(nm);
        var x = el('button', 'file-x', '✕'); x.type = 'button'; x.title = 'เอาออก'; ch.appendChild(x);
        list.appendChild(ch);
        x.addEventListener('click', function () {
          items.splice(items.indexOf(it), 1); ch.remove();
          if (it.id) quiet('task.fileRemove', { fileId: it.id });
        });
        uploading++;
        shrinkImage(f).then(function (g) {
          if (g.size > 10 * 1048576) throw new Error('ไฟล์ "' + f.name + '" ใหญ่เกิน 10 MB');
          var ext = (g.name.split('.').pop() || '').toLowerCase();
          var mime = g.type || MIME_BY_EXT[ext] || '';
          return readB64(g).then(function (b64) {
            return call('task.upload', { name: g.name, mime: mime, data: b64 }).then(function (r) {
              if (!r.ok) throw new Error(r.message);
              it.id = r.fileId; it.name = r.name;
              if (items.indexOf(it) < 0) { quiet('task.fileRemove', { fileId: r.fileId }); return; }
              ch.classList.remove('uploading'); nm.textContent = (/^image\//.test(r.mime) ? '🖼️ ' : '📄 ') + r.name + ' · ' + sizeText(r.size);
            });
          });
        }).catch(function (e) {
          items.splice(items.indexOf(it), 1); ch.remove();
          P.toast(e.message || 'อัปโหลดไม่สำเร็จ', 'err');
        }).then(function () { uploading--; });
      });
    });
    return {
      ids: function () { return items.filter(function (i) { return i.id; }).map(function (i) { return i.id; }); },
      busy: function () { return uploading > 0; },
      reset: function () { items = []; list.textContent = ''; }
    };
  }
  function fileChips(files) {
    var w = el('div', 'tk-files');
    files.forEach(function (f) {
      var b = el('button', 'file-chip', (/^image\//.test(f.mime || '') ? '🖼️ ' : '📄 ') + f.name + (f.size ? ' · ' + sizeText(f.size) : ''));
      b.type = 'button'; b.title = 'เปิดไฟล์';
      b.addEventListener('click', function () { viewFile(f, b); });
      w.appendChild(b);
    });
    return w;
  }
  var lastUrl = null;
  function viewFile(f, btn) {
    P.busy(btn, true, 'กำลังเปิด...');
    call('task.file', { fileId: f.fileId }).then(function (r) {
      P.busy(btn, false);
      if (!r.ok) return P.toast(r.message, 'err');
      var bin = atob(r.data), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(new Blob([arr], { type: r.mime }));
      $('vw-name').textContent = r.name;
      var body = $('vw-body'); body.textContent = '';
      if (/^image\/(jpeg|png|webp|gif)$/.test(r.mime)) { var img = el('img'); img.src = lastUrl; img.alt = r.name; body.appendChild(img); }
      else if (r.mime === 'application/pdf') { var fr = el('iframe'); fr.src = lastUrl; fr.title = r.name; body.appendChild(fr); }
      else body.appendChild(el('p', 'muted', 'ไฟล์ชนิดนี้แสดงในหน้านี้ไม่ได้ กด "ดาวน์โหลด" เพื่อเปิดในเครื่อง'));
      var a = $('vw-download'); a.href = lastUrl; a.download = r.name;
      openDlg($('dlg-viewer'));
    });
  }
  $('vw-close').addEventListener('click', function () { $('dlg-viewer').close(); });

  // ---------- กรอกเหตุผล ----------
  var PR = null;
  function promptNote(title, text, label, required, okLabel, fn) {
    PR = { fn: fn, required: required };
    $('tp-title').textContent = title; $('tp-text').textContent = text || ''; $('tp-label').textContent = label;
    $('tp-note').value = ''; $('tp-ok').textContent = okLabel || 'ยืนยัน'; P.setAlert('tp-alert', '');
    openDlg($('dlg-tk-prompt'));
    setTimeout(function () { $('tp-note').focus(); }, 50);
  }
  $('form-tk-prompt').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tp-note').value.trim();
    if (PR.required && !v) return P.setAlert('tp-alert', 'กรุณากรอก' + $('tp-label').textContent);
    var btn = $('tp-ok'); P.busy(btn, true, 'กำลังบันทึก...');
    PR.fn(v).then(function (r) {
      P.busy(btn, false);
      if (r && r.ok) $('dlg-tk-prompt').close(); else P.setAlert('tp-alert', (r && r.message) || 'บันทึกไม่สำเร็จ');
    });
  });
  $('tp-cancel').addEventListener('click', function () { $('dlg-tk-prompt').close(); });

  // ---------- รายละเอียดงาน ----------
  function openTask(taskId) {
    S.cur = taskId;
    $('tk-title').textContent = 'กำลังโหลด...';
    P.skeleton($('tk-body'), 3);
    openDlg($('dlg-task'));
    return call('task.get', { taskId: taskId }).then(function (r) {
      if (S.cur !== taskId) return;
      if (!guard(r)) return;
      if (!r.ok) { $('tk-title').textContent = 'เปิดงานไม่ได้'; $('tk-body').textContent = r.message; return; }
      renderTask(r);
    });
  }
  function afterChange(msg) {
    P.toast(msg, 'ok');
    refreshSummary(true);
    if (!$('view-tasks').hidden) loadList(true);
    if (S.cur) openTask(S.cur);
  }
  function act(btn, data, msgFallback) {
    P.busy(btn, true, 'กำลังบันทึก...');
    data.taskId = S.cur;
    return call('task.act', data).then(function (r) {
      P.busy(btn, false);
      if (!r.ok) { P.toast(r.message, 'err'); return r; }
      afterChange(r.message || msgFallback); return r;
    });
  }
  function section(title, cls) {
    var s = el('div', 'tk-sec' + (cls ? ' ' + cls : ''));
    if (title) s.appendChild(el('h3', null, title));
    return s;
  }
  function renderTask(r) {
    var t = r.task, body = $('tk-body'); body.textContent = '';
    $('tk-title').textContent = t.title;
    var head = el('div', 'row-flags tk-head-flags');
    var ts = TASK_ST[t.status] || [t.status, ''];
    head.appendChild(chip(ts[0], ts[1]));
    if (PRIO[t.priority]) head.appendChild(chip(PRIO[t.priority][0], PRIO[t.priority][1]));
    if (!t.requiresReview) head.appendChild(chip('ไม่ต้องตรวจรับ', ''));
    (t.groups || []).forEach(function (g) { head.appendChild(chip('กลุ่ม ' + P.groupLabel(g), 'info')); });
    body.appendChild(head);
    var meta = el('p', 'muted tk-meta', 'มอบโดย ' + (t.createdByName || '-') + ' · ' + P.fmtTime(t.createdAt) + ' · รหัสงาน ' + t.taskId);
    body.appendChild(meta);
    var di = dueInfo(t.dueAt, t.status !== 'open' || (r.me && ['submitted', 'approved', 'rejected', 'cancelled'].indexOf(r.me.status) >= 0));
    if (di) body.appendChild(el('p', 'tk-due big ' + di[1], '📅 ' + di[0]));
    if (t.status === 'cancelled') body.appendChild(el('div', 'alert', '🛑 งานนี้ถูกยกเลิก' + (t.cancelReason ? ': ' + t.cancelReason : '')));
    if (t.detail) body.appendChild(el('div', 'tk-detail', t.detail));
    var taskFiles = r.files.filter(function (f) { return !f.userId; });
    if (taskFiles.length) { var fs = section('📎 ไฟล์ประกอบงาน'); fs.appendChild(fileChips(taskFiles)); body.appendChild(fs); }
    if (t.actionUrl) {
      var ab = el('a', 'btn btn-edit btn-sm', '🔗 ' + (t.actionLabel || 'เปิดระบบที่เกี่ยวข้อง'));
      ab.href = t.actionUrl; ab.target = '_blank'; ab.rel = 'noopener'; body.appendChild(ab);
    }
    if (r.me) body.appendChild(renderMine(r, t));
    if (r.isReviewer) body.appendChild(renderReviewer(r, t));
    body.appendChild(renderTimeline(r));
  }

  function renderMine(r, t) {
    var me = r.me, s = section('👤 งานของฉัน', 'tk-mine');
    var st = ST_LABEL[me.status] || [me.status, ''];
    var line = el('div', 'row-flags'); line.appendChild(chip(st[0], st[1]));
    if (me.returnCount) line.appendChild(chip('ส่งแก้ไขแล้ว ' + me.returnCount + ' ครั้ง', ''));
    s.appendChild(line);
    if (me.progress > 0 && me.status !== 'approved') { s.appendChild(progressBar(me.progress)); s.appendChild(el('div', 'muted tk-pct', 'ความคืบหน้า ' + me.progress + '%')); }
    if (me.status === 'returned' && me.reviewRemark) s.appendChild(el('div', 'alert warn', '↩️ สิ่งที่ต้องแก้ไข: ' + me.reviewRemark));
    if (me.result && ['submitted', 'approved', 'returned'].indexOf(me.status) >= 0) {
      s.appendChild(el('div', 'tk-label', 'ผลการดำเนินงานที่ส่ง')); s.appendChild(el('div', 'tk-detail', me.result));
    }
    if (me.status === 'approved' && me.reviewRemark) s.appendChild(el('div', 'alert info', '✅ ' + me.reviewRemark));
    if (me.status === 'rejected') s.appendChild(el('div', 'muted', 'คุณปฏิเสธงานนี้: ' + (me.rejectReason || '-')));
    var myFiles = r.files.filter(function (f) { return f.userId === me.userId; });
    if (myFiles.length) { s.appendChild(el('div', 'tk-label', 'ไฟล์ที่ฉันแนบ')); s.appendChild(fileChips(myFiles)); }
    if (t.status !== 'open') return s;

    if (me.status === 'assigned') {
      var acts = el('div', 'dialog-actions tk-acts');
      var rej = el('button', 'btn btn-ghost', '🚫 ปฏิเสธงาน'); rej.type = 'button';
      var acc = el('button', 'btn btn-primary', '✋ รับงาน'); acc.type = 'button';
      rej.addEventListener('click', function () {
        promptNote('ปฏิเสธงาน', t.title, 'เหตุผลที่ปฏิเสธ', true, 'ปฏิเสธงาน', function (note) {
          return call('task.act', { taskId: t.taskId, action: 'reject', note: note }).then(function (x) { if (x.ok) afterChange(x.message); return x; });
        });
      });
      acc.addEventListener('click', function () { act(acc, { action: 'accept' }, 'รับงานแล้ว'); });
      acts.appendChild(rej); acts.appendChild(acc); s.appendChild(acts);
    } else if (['accepted', 'in_progress', 'returned'].indexOf(me.status) >= 0) {
      // ความคืบหน้า
      var pg = el('div', 'tk-form');
      pg.appendChild(el('div', 'tk-label', '⏳ บันทึกความคืบหน้า'));
      var rw = el('div', 'tk-range');
      var rg = el('input'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.step = 10; rg.value = me.progress || 0; rg.setAttribute('aria-label', 'ความคืบหน้า');
      var rv = el('b', null, (me.progress || 0) + '%');
      rg.addEventListener('input', function () { rv.textContent = rg.value + '%'; });
      rw.appendChild(rg); rw.appendChild(rv); pg.appendChild(rw);
      var pn = el('textarea'); pn.rows = 2; pn.maxLength = 2000; pn.placeholder = 'บันทึกสิ่งที่ทำไปแล้ว / ปัญหาที่พบ (ไม่บังคับ)';
      pg.appendChild(pn);
      var pfBox = el('div'); pg.appendChild(pfBox); var pf = attachBox(pfBox);
      var pb = el('button', 'btn btn-edit', '💾 บันทึกความคืบหน้า'); pb.type = 'button';
      pb.addEventListener('click', function () {
        if (pf.busy()) return P.toast('รออัปโหลดไฟล์ให้เสร็จก่อน', 'err');
        act(pb, { action: 'progress', progress: Number(rg.value), note: pn.value.trim(), fileIds: pf.ids() }, 'บันทึกแล้ว');
      });
      pg.appendChild(pb); s.appendChild(pg);
      // ส่งผล
      var sm = el('div', 'tk-form tk-submit');
      sm.appendChild(el('div', 'tk-label', '📤 ส่งผลการดำเนินงาน'));
      var rs = el('textarea'); rs.rows = 4; rs.maxLength = 5000; rs.placeholder = 'สรุปผลการดำเนินงาน *';
      if (me.status === 'returned' && me.result) rs.value = me.result;
      sm.appendChild(rs);
      sm.appendChild(el('p', 'hint left', '🔒 ห้ามใส่ชื่อ-นามสกุลหรือเลขบัตรประชาชนผู้ป่วย'));
      var sfBox = el('div'); sm.appendChild(sfBox); var sf = attachBox(sfBox);
      var sb = el('button', 'btn btn-primary', t.requiresReview ? '📤 ส่งผลงานให้ตรวจรับ' : '📤 ส่งผลงาน (ปิดงาน)'); sb.type = 'button';
      sb.addEventListener('click', function () {
        if (!rs.value.trim()) { rs.focus(); return P.toast('กรุณากรอกผลการดำเนินงาน', 'err'); }
        if (sf.busy()) return P.toast('รออัปโหลดไฟล์ให้เสร็จก่อน', 'err');
        act(sb, { action: 'submit', result: rs.value.trim(), fileIds: sf.ids() }, 'ส่งผลงานแล้ว');
      });
      sm.appendChild(sb); s.appendChild(sm);
    } else if (me.status === 'submitted') {
      s.appendChild(el('p', 'muted', '⏳ ส่งผลงานแล้ว รอผู้มอบหมายตรวจรับ'));
    }
    return s;
  }

  function renderReviewer(r, t) {
    var s = section('👥 ผู้รับงาน (' + r.assignees.length + ' คน)', 'tk-review');
    var cnt = {}; r.assignees.forEach(function (a) { cnt[a.status] = (cnt[a.status] || 0) + 1; });
    var sum = el('div', 'row-flags');
    Object.keys(ST_LABEL).forEach(function (k) { if (cnt[k]) sum.appendChild(chip(ST_LABEL[k][0] + ' ' + cnt[k], ST_LABEL[k][1])); });
    s.appendChild(sum);
    r.assignees.forEach(function (a) {
      var box = el('div', 'tk-person' + (a.status === 'submitted' ? ' hl' : ''));
      var top = el('div', 'tk-person-top');
      top.appendChild(el('b', null, a.fullName || '-'));
      var st = ST_LABEL[a.status] || [a.status, ''];
      top.appendChild(chip(st[0], st[1]));
      if (a.viaGroup) top.appendChild(chip('ผ่านกลุ่ม ' + P.groupLabel(a.viaGroup), ''));
      if (a.returnCount) top.appendChild(chip('แก้ไข ' + a.returnCount + ' ครั้ง', ''));
      box.appendChild(top);
      if (a.progress > 0 && ['approved', 'rejected', 'cancelled'].indexOf(a.status) < 0) box.appendChild(progressBar(a.progress));
      if (a.status === 'rejected') box.appendChild(el('div', 'muted', 'เหตุผล: ' + (a.rejectReason || '-')));
      if (a.result) { box.appendChild(el('div', 'tk-label', 'ผลการดำเนินงาน' + (a.submittedAt ? ' · ' + P.fmtTime(a.submittedAt) : ''))); box.appendChild(el('div', 'tk-detail', a.result)); }
      if (a.reviewRemark && a.status !== 'submitted') box.appendChild(el('div', 'muted', (a.status === 'returned' ? '↩️ ส่งแก้: ' : '💬 ') + a.reviewRemark));
      var files = r.files.filter(function (f) { return f.userId === a.userId; });
      if (files.length) box.appendChild(fileChips(files));
      if (a.status === 'submitted' && t.status === 'open') {
        var acts = el('div', 'dialog-actions tk-acts');
        var rt = el('button', 'btn btn-ghost btn-sm', '↩️ ส่งกลับแก้ไข'); rt.type = 'button';
        var ap = el('button', 'btn btn-primary btn-sm', '✅ ตรวจรับ'); ap.type = 'button';
        rt.addEventListener('click', function () {
          promptNote('ส่งกลับให้แก้ไข', a.fullName, 'สิ่งที่ต้องแก้ไข', true, 'ส่งกลับแก้ไข', function (note) {
            return call('task.review', { taskId: t.taskId, userId: a.userId, action: 'return', note: note }).then(function (x) { if (x.ok) afterChange(x.message); return x; });
          });
        });
        ap.addEventListener('click', function () {
          P.busy(ap, true, 'กำลังบันทึก...');
          call('task.review', { taskId: t.taskId, userId: a.userId, action: 'approve' }).then(function (x) {
            P.busy(ap, false);
            if (!x.ok) return P.toast(x.message, 'err');
            afterChange(x.message);
          });
        });
        acts.appendChild(rt); acts.appendChild(ap); box.appendChild(acts);
      }
      s.appendChild(box);
    });
    if (t.status === 'open') {
      var cb = el('button', 'btn btn-ghost btn-sm tk-cancel', '🛑 ยกเลิกงานนี้'); cb.type = 'button';
      cb.addEventListener('click', function () {
        promptNote('ยกเลิกงาน', 'ผู้รับงานที่ยังไม่เสร็จจะถูกยกเลิกทั้งหมด และได้รับแจ้งเตือน', 'เหตุผล (ไม่บังคับ)', false, 'ยกเลิกงาน', function (note) {
          return call('task.cancel', { taskId: t.taskId, note: note }).then(function (x) { if (x.ok) afterChange(x.message); return x; });
        });
      });
      s.appendChild(cb);
    }
    return s;
  }

  function renderTimeline(r) {
    var s = section('🕘 ความเคลื่อนไหว', 'tk-timeline');
    var ol = el('ol', 'tl');
    r.events.slice().reverse().forEach(function (e) {
      var li = el('li');
      var h = el('div', 'tl-head');
      h.appendChild(el('b', null, EV_LABEL[e.kind] || e.kind));
      h.appendChild(el('span', 'muted', ' · ' + (e.actorName || '-') + ' · ' + P.fmtTime(e.at)));
      li.appendChild(h);
      if (e.kind === 'progress' && e.progress !== null && e.progress !== undefined) li.appendChild(el('div', 'muted', 'ความคืบหน้า ' + e.progress + '%'));
      if (e.note) li.appendChild(el('div', 'tl-note', e.note));
      var files = r.files.filter(function (f) { return f.eventId === e.id; });
      if (files.length) li.appendChild(fileChips(files));
      ol.appendChild(li);
    });
    s.appendChild(ol);
    return s;
  }
  $('tk-close').addEventListener('click', function () { $('dlg-task').close(); });
  $('dlg-task').addEventListener('close', function () { S.cur = null; });

  // ---------- มอบหมายงาน ----------
  var NEW = { users: {}, files: null };
  function openNew() {
    P.setAlert('tn-alert', '');
    $('form-task-new').reset(); $('tn-review').checked = true;
    P.dateSet($('tn-due'), '');
    NEW.users = {};
    NEW.files = attachBox($('tn-files'));
    $('tn-groups').textContent = ''; $('tn-users').textContent = '';
    P.skeleton($('tn-users'), 2);
    openDlg($('dlg-task-new'));
    (S.opts ? Promise.resolve({ ok: true, groups: S.opts.groups, users: S.opts.users }) : call('task.assignOptions')).then(function (r) {
      if (!r.ok) { $('tn-users').textContent = r.message; return; }
      S.opts = r;
      r.groups.forEach(function (g) {
        var l = el('label', 'check'); var c = el('input'); c.type = 'checkbox'; c.value = g.key; c.name = 'tn-group';
        l.appendChild(c); l.appendChild(el('span', null, g.label)); $('tn-groups').appendChild(l);
      });
      if (!r.groups.length) $('tn-groups').appendChild(el('span', 'muted', 'ไม่มีกลุ่มงานที่มอบได้'));
      renderUserPick();
    });
  }
  function renderUserPick() {
    var wrap = $('tn-users'); wrap.textContent = '';
    var q = $('tn-user-search').value.trim().toLowerCase(), shown = 0, users = (S.opts && S.opts.users) || [];
    var list = users.filter(function (u) {
      return NEW.users[u.id] || !q || (u.name + ' ' + u.username + ' ' + u.position).toLowerCase().indexOf(q) >= 0;
    });
    list.sort(function (a, b) { return (NEW.users[b.id] ? 1 : 0) - (NEW.users[a.id] ? 1 : 0); });
    list.slice(0, 60).forEach(function (u) {
      var l = el('label', 'check tn-user'); var c = el('input'); c.type = 'checkbox'; c.checked = !!NEW.users[u.id];
      c.addEventListener('change', function () { if (c.checked) NEW.users[u.id] = true; else delete NEW.users[u.id]; pickedText(); });
      l.appendChild(c);
      var t = el('span'); t.appendChild(el('span', null, u.name));
      var sub = [u.position, u.groups.map(P.groupLabel).join(', ')].filter(Boolean).join(' · ');
      if (sub) t.appendChild(el('small', 'muted', ' ' + sub));
      l.appendChild(t); wrap.appendChild(l); shown++;
    });
    if (list.length > 60) wrap.appendChild(el('p', 'muted', 'แสดง 60 จาก ' + list.length + ' คน — พิมพ์ค้นหาเพื่อกรอง'));
    if (!shown) wrap.appendChild(el('p', 'muted', 'ไม่พบรายชื่อ'));
    pickedText();
  }
  function pickedText() { var n = Object.keys(NEW.users).length; $('tn-picked').textContent = n ? '(เลือกแล้ว ' + n + ' คน)' : ''; }
  $('tn-user-search').addEventListener('input', renderUserPick);
  $('tn-cancel').addEventListener('click', function () { $('dlg-task-new').close(); });
  $('form-task-new').addEventListener('submit', function (e) {
    e.preventDefault();
    var groups = Array.prototype.filter.call(document.querySelectorAll('input[name=tn-group]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    var users = Object.keys(NEW.users);
    var title = $('tn-title').value.trim();
    if (!title) return P.setAlert('tn-alert', 'กรุณากรอกชื่องาน');
    if (!groups.length && !users.length) return P.setAlert('tn-alert', 'กรุณาเลือกผู้รับงานอย่างน้อย 1 คนหรือ 1 กลุ่มงาน');
    var due = P.dateGet($('tn-due')), dueIso = due ? new Date(due).toISOString() : '';
    if (dueIso && new Date(dueIso).getTime() <= Date.now()) return P.setAlert('tn-alert', 'กำหนดส่งต้องอยู่ในอนาคต');
    if (NEW.files.busy()) return P.setAlert('tn-alert', 'รออัปโหลดไฟล์ให้เสร็จก่อน');
    var btn = $('tn-save'); P.busy(btn, true, 'กำลังมอบหมาย...');
    call('task.create', { task: {
      title: title, detail: $('tn-detail').value.trim(), priority: $('tn-priority').value, dueAt: dueIso,
      requiresReview: $('tn-review').checked, users: users, groups: groups, fileIds: NEW.files.ids()
    } }).then(function (r) {
      P.busy(btn, false);
      if (!r.ok) return P.setAlert('tn-alert', r.message);
      $('dlg-task-new').close();
      P.toast(r.message, 'ok');
      refreshSummary(true);
      if (!$('view-tasks').hidden) switchBox('assigned'); else open('assigned');
    });
  });

  // ---------- แจ้งเตือน ----------
  function openNotif() {
    var wrap = $('nf-list'); P.skeleton(wrap, 3);
    openDlg($('dlg-notif'));
    call('notif.list', { limit: 40 }).then(function (r) {
      wrap.textContent = '';
      if (!guard(r)) return;
      if (!r.ok) { wrap.textContent = r.message; return; }
      if (!r.items.length) { wrap.appendChild(el('p', 'empty', 'ยังไม่มีการแจ้งเตือน')); return; }
      r.items.forEach(function (n) {
        var b = el('button', 'nf-item' + (n.read ? '' : ' unread')); b.type = 'button';
        b.appendChild(el('span', 'nf-icon', NF_ICON[n.kind] || '🔔'));
        var tx = el('span', 'nf-text');
        tx.appendChild(el('b', null, n.title));
        if (n.body) tx.appendChild(el('span', 'nf-body', n.body));
        tx.appendChild(el('span', 'muted nf-time', P.fmtTime(n.at)));
        b.appendChild(tx);
        b.addEventListener('click', function () {
          if (!n.read) { quiet('notif.read', { ids: [n.id] }).then(function () { refreshSummary(true); }); }
          $('dlg-notif').close();
          if (n.taskId) openTask(n.taskId);
        });
        wrap.appendChild(b);
      });
    });
  }
  $('btn-bell').addEventListener('click', openNotif);
  $('nf-close').addEventListener('click', function () { $('dlg-notif').close(); });
  $('nf-readall').addEventListener('click', function () {
    var btn = $('nf-readall'); P.busy(btn, true, 'กำลังบันทึก...');
    call('notif.read', { all: true }).then(function () {
      P.busy(btn, false);
      Array.prototype.forEach.call(document.querySelectorAll('#nf-list .unread'), function (x) { x.classList.remove('unread'); });
      refreshSummary(true);
    });
  });

  // ---------- ปุ่ม / ผูกเหตุการณ์ ----------
  Array.prototype.forEach.call(document.querySelectorAll('#home-tasks [data-open-box]'), function (b) {
    b.addEventListener('click', function () { open(b.dataset.openBox, b.dataset.openBox === 'review'); });
  });
  $('tk-refresh').addEventListener('click', function () { refreshSummary(true); loadList(true); });
  $('tk-back').addEventListener('click', function () {
    if (history.state && history.state.phc37View === 'tasks') { history.back(); return; }
    P.goHome();
  });
  window.addEventListener('popstate', function () {
    if (!$('view-tasks').hidden && !(history.state && history.state.phc37View === 'tasks')) P.goHome();
  });
  Array.prototype.forEach.call(document.querySelectorAll('#view-tasks .tab'), function (t) {
    t.addEventListener('click', function () { switchBox(t.dataset.box); });
  });
  $('tk-all').addEventListener('change', function () { loadList(); });
  $('tk-new').addEventListener('click', openNew);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !$('shell').hidden) refreshSummary(false);
  });
  P.initDatePickers($('dlg-task-new'));

  if (!$('view-home').hidden && P.token()) refreshSummary(true);   // หน้าหลักแสดงก่อนไฟล์นี้โหลด (ข้อมูลในเครื่อง)

  window.PHC37Tasks = { open: open, openTask: openTask, refresh: refreshSummary, reset: function () { S.summary = null; S.opts = null; S.sumAt = 0; $('home-tasks').hidden = true; $('bell-badge').hidden = true; $('nav-assign').hidden = true; $('nav-task-badge').hidden = true; $('nav-review-badge').hidden = true; } };
})();
