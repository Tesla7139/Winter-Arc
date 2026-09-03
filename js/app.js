/* =====================================================================
   WINTER ARC — app.js
   Gate (login) -> themed dashboard -> tick / cross -> stats.
   No frameworks. Everything routes through WA_Store for persistence.
   ===================================================================== */

(function () {
  'use strict';

  var CFG = window.WA_CONFIG;
  var Store = window.WA_Store;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ============================== DATES ============================== */

  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayISO() { return iso(new Date()); }
  function addDays(s, n) { var d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((fromISO(b) - fromISO(a)) / 86400000); }
  function dowIndex(s) { return (fromISO(s).getDay() + 6) % 7; }          // 0 = Monday
  function mondayOf(s) { return addDays(s, -dowIndex(s)); }
  function fmtDate(s) { var d = fromISO(s); return DOW[dowIndex(s)] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function fmtLong(s) { var d = fromISO(s); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); }

  function relLabel(s) {
    var d = diffDays(todayISO(), s);
    if (d === 0) return 'Today';
    if (d === -1) return 'Yesterday';
    if (d === 1) return 'Tomorrow';
    return (d < 0 ? Math.abs(d) + ' days ago' : 'in ' + d + ' days');
  }

  /* ============================== STATE ============================== */

  var S = {
    userId: null,
    user: null,
    data: { days: {} },
    rival: null,
    rivalData: { days: {} },
    view: todayISO(),
    month: null,
    noteTimer: null
  };

  var THRESHOLD = (CFG.challenge && CFG.challenge.winThreshold) || 0.8;
  var ARC_START = (CFG.challenge && CFG.challenge.start) || todayISO();
  var ARC_DAYS = (CFG.challenge && CFG.challenge.days) || 90;
  var ARC_END = addDays(ARC_START, ARC_DAYS - 1);

  function arcDayNumber(date) {
    return Math.min(ARC_DAYS, Math.max(1, diffDays(ARC_START, date) + 1));
  }

  /* ============================== SCORING ============================== */

  function dayOf(data, date) {
    var d = data.days[date];
    return d ? d : { tasks: {}, note: '' };
  }

  function ensureDay(date) {
    if (!S.data.days[date]) S.data.days[date] = { tasks: {}, note: '' };
    if (!S.data.days[date].tasks) S.data.days[date].tasks = {};
    return S.data.days[date];
  }

  function score(data, tasks, date) {
    var t = dayOf(data, date).tasks || {};
    var done = 0, miss = 0;
    tasks.forEach(function (x) {
      if (t[x.id] === 'done') done++;
      else if (t[x.id] === 'miss') miss++;
    });
    return { done: done, miss: miss, total: tasks.length, pct: tasks.length ? done / tasks.length : 0 };
  }

  function isWin(data, tasks, date) {
    var s = score(data, tasks, date);
    return s.done > 0 && s.pct >= THRESHOLD;
  }

  function loggedDays(data) {
    return Object.keys(data.days).filter(function (d) {
      var day = data.days[d];
      return day && day.tasks && Object.keys(day.tasks).length > 0;
    }).sort();
  }

  function currentStreak(data, tasks) {
    var t = todayISO();
    var cursor = isWin(data, tasks, t) ? t : addDays(t, -1);
    var n = 0;
    while (isWin(data, tasks, cursor) && n < 3650) { n++; cursor = addDays(cursor, -1); }
    return n;
  }

  function bestStreak(data, tasks) {
    var wins = loggedDays(data).filter(function (d) { return isWin(data, tasks, d); });
    var best = 0, run = 0, prev = null;
    wins.forEach(function (d) {
      run = (prev && diffDays(prev, d) === 1) ? run + 1 : 1;
      prev = d;
      if (run > best) best = run;
    });
    return best;
  }

  function winCount(data, tasks) {
    return loggedDays(data).filter(function (d) { return isWin(data, tasks, d); }).length;
  }

  function avgCompletion(data, tasks) {
    var days = loggedDays(data);
    if (!days.length) return 0;
    var sum = 0;
    days.forEach(function (d) { sum += score(data, tasks, d).pct; });
    return sum / days.length;
  }

  function weeklyDone(data, tasks, taskId, date) {
    var start = mondayOf(date), n = 0;
    for (var i = 0; i < 7; i++) {
      var t = dayOf(data, addDays(start, i)).tasks || {};
      if (t[taskId] === 'done') n++;
    }
    return n;
  }

  function distinctWeeks(data) {
    var seen = {};
    loggedDays(data).forEach(function (d) { seen[mondayOf(d)] = 1; });
    return Object.keys(seen).length;
  }

  /* ============================== GATE ============================== */

  function initGate() {
    $('#gateMeta').textContent = 'Day ' + arcDayNumber(todayISO()) + ' / ' + ARC_DAYS;

    $$('.gate').forEach(function (gate) {
      var id = gate.getAttribute('data-user');
      var u = CFG.users[id];
      if (!u) return;

      var form = $('.gate-form', gate);
      var input = $('input', gate);
      var err = $('.gate-err', gate);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = (input.value || '').trim();
        if (!val) { fail('Enter your passcode.'); return; }
        if (val !== String(u.passcode)) { fail('Wrong passcode. Try again.'); return; }
        err.classList.remove('show');
        input.value = '';
        login(id);
      });

      input.addEventListener('input', function () { err.classList.remove('show'); });

      function fail(msg) {
        err.textContent = msg;
        err.classList.add('show');
        gate.classList.remove('shake');
        void gate.offsetWidth;
        gate.classList.add('shake');
        input.focus();
      }
    });
  }

  function login(userId) {
    Store.setSession(userId);
    var wrap = $('#gate');
    wrap.classList.add('leaving');
    setTimeout(function () { boot(userId); }, 420);
  }

  function logout() {
    Store.clearSession();
    location.reload();
  }

  /* ============================== BOOT ============================== */

  function boot(userId) {
    var u = CFG.users[userId];
    if (!u) { logout(); return; }

    S.userId = userId;
    S.user = u;
    S.view = todayISO();
    S.month = iso(new Date(fromISO(S.view).getFullYear(), fromISO(S.view).getMonth(), 1));
    S.rival = u.rival && CFG.users[u.rival] ? CFG.users[u.rival] : null;

    document.documentElement.setAttribute('data-theme', u.theme);
    document.body.classList.remove('mode-gate');
    $('#gate').hidden = true;
    $('#gate').style.display = 'none';
    $('#app').hidden = false;

    // static copy
    $('#whoName').textContent = u.name;
    $('#heroTitle').textContent = u.name;
    $('#heroLine').textContent = u.line;
    $('#tasksTitle').textContent = u.listTitle || 'Daily protocol';
    $('#noteTitle').textContent = u.noteTitle || 'Log';
    $('#rivalTitle').textContent = u.rivalTitle || 'The other one';
    $('#footRange').textContent = fmtLong(ARC_START) + ' — ' + fmtLong(ARC_END);

    var left = diffDays(todayISO(), ARC_END);
    $('#footLeft').textContent = left >= 0 ? left + ' days left' : 'arc complete';

    wireApp();

    Store.load(userId).then(function (data) {
      S.data = data;
      setSyncBadge();
      renderAll();
    });

    if (S.rival) {
      Store.load(S.rival.id).then(function (data) {
        S.rivalData = data;
        renderRival();
      });
    }
  }

  function setSyncBadge() {
    var el = $('#syncDot');
    el.textContent = Store.mode;
    el.classList.toggle('is-cloud', Store.mode === 'cloud');
  }

  /* ============================== WIRING ============================== */

  function wireApp() {
    $('#prevDay').addEventListener('click', function () { setView(addDays(S.view, -1)); });
    $('#nextDay').addEventListener('click', function () { setView(addDays(S.view, 1)); });
    $('#todayBtn').addEventListener('click', function () { setView(todayISO()); });
    $('#logoutBtn').addEventListener('click', logout);

    $('#prevMonth').addEventListener('click', function () { shiftMonth(-1); });
    $('#nextMonth').addEventListener('click', function () { shiftMonth(1); });

    $('#allDone').addEventListener('click', function () {
      var day = ensureDay(S.view);
      S.user.tasks.forEach(function (t) { day.tasks[t.id] = 'done'; });
      persist(S.view);
      renderAll();
      toast('Day cleared. All of it.');
    });

    $('#clearDay').addEventListener('click', function () {
      var day = ensureDay(S.view);
      day.tasks = {};
      persist(S.view);
      renderAll();
    });

    $('#taskList').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.tbtn') : null;
      if (!btn) return;
      var li = btn.closest('.task');
      var id = li.getAttribute('data-id');
      var want = btn.getAttribute('data-act');
      var day = ensureDay(S.view);
      if (day.tasks[id] === want) delete day.tasks[id];
      else day.tasks[id] = want;
      persist(S.view);
      renderAll();
      maybeCelebrate();
    });

    var note = $('#note');
    note.addEventListener('input', function () {
      var day = ensureDay(S.view);
      day.note = note.value;
      $('#noteHint').textContent = 'saving…';
      clearTimeout(S.noteTimer);
      S.noteTimer = setTimeout(function () {
        persist(S.view);
        $('#noteHint').textContent = 'saved';
        setTimeout(function () { $('#noteHint').innerHTML = '&nbsp;'; }, 1600);
      }, 600);
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') setView(addDays(S.view, -1));
      if (e.key === 'ArrowRight') setView(addDays(S.view, 1));
      if (e.key === 't' || e.key === 'T') setView(todayISO());
    });
  }

  function persist(date) {
    var day = ensureDay(date);
    Store.saveDay(S.userId, date, day, S.data).then(setSyncBadge);
  }

  function setView(date) {
    S.view = date;
    S.month = iso(new Date(fromISO(date).getFullYear(), fromISO(date).getMonth(), 1));
    renderAll();
  }

  function shiftMonth(n) {
    var d = fromISO(S.month);
    S.month = iso(new Date(d.getFullYear(), d.getMonth() + n, 1));
    renderCalendar();
  }

  /* ============================== RENDER ============================== */

  function renderAll() {
    renderHero();
    renderWeek();
    renderTasks();
    renderNote();
    renderCalendar();
    renderBars();
    renderRival();
  }

  function renderHero() {
    var tasks = S.user.tasks;
    var s = score(S.data, tasks, S.view);
    var pct = Math.round(s.pct * 100);

    $('#dayChip').textContent = 'Day ' + arcDayNumber(S.view) + ' / ' + ARC_DAYS;
    $('#dateLabel').textContent = fmtDate(S.view);
    $('#dateRel').textContent = relLabel(S.view);

    $('#ringPct').textContent = pct + '%';
    $('#ringCount').textContent = s.done + ' / ' + s.total;

    var C = 2 * Math.PI * 52;
    $('#ringFill').style.strokeDasharray = C;
    $('#ringFill').style.strokeDashoffset = C * (1 - s.pct);

    $('#statStreak').textContent = currentStreak(S.data, tasks);
    $('#statBest').textContent = bestStreak(S.data, tasks);
    $('#statWins').textContent = winCount(S.data, tasks);
    $('#statAvg').textContent = Math.round(avgCompletion(S.data, tasks) * 100) + '%';
  }

  function renderWeek() {
    var wrap = $('#weekStrip');
    var tasks = S.user.tasks;
    var end = S.view;
    var html = '', sum = 0;

    for (var i = 6; i >= 0; i--) {
      var d = addDays(end, -i);
      var s = score(S.data, tasks, d);
      sum += s.pct;
      var cls = 'wd';
      if (d === S.view) cls += ' is-view';
      if (d === todayISO()) cls += ' is-today';
      if (isWin(S.data, tasks, d)) cls += ' is-win';
      html += '<button type="button" class="' + cls + '" data-date="' + d + '">' +
                '<span class="wd-dow">' + DOW[dowIndex(d)].charAt(0) + '</span>' +
                '<span class="wd-bar"><i style="height:' + Math.round(s.pct * 100) + '%"></i></span>' +
                '<span class="wd-num">' + fromISO(d).getDate() + '</span>' +
              '</button>';
    }

    wrap.innerHTML = html;
    $('#weekPct').textContent = Math.round((sum / 7) * 100) + '% average';

    $$('.wd', wrap).forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-date')); });
    });
  }

  var SVG_TICK = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 8.6l3 3 6.6-7.2"/></svg>';
  var SVG_CROSS = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/></svg>';

  function renderTasks() {
    var list = $('#taskList');
    var day = dayOf(S.data, S.view);
    var html = '';

    S.user.tasks.forEach(function (t, i) {
      var st = day.tasks ? day.tasks[t.id] : null;
      var cls = 'task' + (st === 'done' ? ' is-done' : st === 'miss' ? ' is-miss' : '');
      var meta = '';

      if (t.weekly) {
        var n = weeklyDone(S.data, S.user.tasks, t.id, S.view);
        meta = n >= t.weekly
          ? '<span class="task-meta hit">' + n + '&times; this week &middot; target met</span>'
          : '<span class="task-meta">' + n + ' / ' + t.weekly + ' this week</span>';
      }

      html += '<li class="' + cls + '" data-id="' + t.id + '">' +
                '<span class="task-idx">' + pad(i + 1) + '</span>' +
                '<span class="task-main"><span class="task-name">' + t.name + '</span>' + meta + '</span>' +
                '<span class="task-btns">' +
                  '<button type="button" class="tbtn tbtn-done" data-act="done" aria-label="Done: ' + t.name + '">' + SVG_TICK + '</button>' +
                  '<button type="button" class="tbtn tbtn-miss" data-act="miss" aria-label="Missed: ' + t.name + '">' + SVG_CROSS + '</button>' +
                '</span>' +
              '</li>';
    });

    list.innerHTML = html;
  }

  function renderNote() {
    $('#note').value = dayOf(S.data, S.view).note || '';
  }

  function renderCalendar() {
    var cal = $('#cal');
    var tasks = S.user.tasks;
    var first = fromISO(S.month);
    var y = first.getFullYear(), m = first.getMonth();
    var lead = (first.getDay() + 6) % 7;
    var total = new Date(y, m + 1, 0).getDate();
    var today = todayISO();
    var html = '';

    $('#monthLabel').textContent = MONTHS[m] + ' ' + y;

    for (var i = 0; i < lead; i++) html += '<div class="cell empty"></div>';

    for (var d = 1; d <= total; d++) {
      var date = y + '-' + pad(m + 1) + '-' + pad(d);
      var s = score(S.data, tasks, date);
      var cls = 'cell';
      if (s.pct >= 0.55) cls += ' filled';
      if (date === S.view) cls += ' is-view';
      if (date === today) cls += ' is-today';
      if (isWin(S.data, tasks, date)) cls += ' is-win';
      if (diffDays(today, date) > 0) cls += ' future';
      html += '<button type="button" class="' + cls + '" data-date="' + date + '" ' +
              'style="--f:' + s.pct.toFixed(2) + '" title="' + fmtDate(date) + ' — ' + s.done + '/' + s.total + '">' + d + '</button>';
    }

    cal.innerHTML = html;

    $$('.cell:not(.empty)', cal).forEach(function (c) {
      c.addEventListener('click', function () { setView(c.getAttribute('data-date')); });
    });
  }

  function renderBars() {
    var list = $('#taskBars');
    var days = loggedDays(S.data);
    var weeks = Math.max(1, distinctWeeks(S.data));
    var html = '';

    S.user.tasks.forEach(function (t) {
      var done = 0;
      days.forEach(function (d) {
        if ((S.data.days[d].tasks || {})[t.id] === 'done') done++;
      });

      var pct, sub;
      if (t.weekly) {
        var target = weeks * t.weekly;
        pct = target ? Math.min(1, done / target) : 0;
        sub = done + ' of ' + target;
      } else {
        pct = days.length ? done / days.length : 0;
        sub = done + ' of ' + days.length;
      }

      html += '<li class="bar-row">' +
                '<span class="bar-label">' + t.name + ' <span class="label">· ' + sub + '</span></span>' +
                '<span class="bar-pct">' + Math.round(pct * 100) + '%</span>' +
                '<span class="bar-track"><i style="width:' + Math.round(pct * 100) + '%"></i></span>' +
              '</li>';
    });

    list.innerHTML = html || '<li class="bar-label">Nothing logged yet.</li>';
  }

  function renderRival() {
    if (!S.rival) return;
    var r = S.rival;
    var rTasks = r.tasks;
    var today = todayISO();
    var s = score(S.rivalData, rTasks, today);
    var pct = Math.round(s.pct * 100);

    $('#rivalName').textContent = r.name;
    $('#rivalBar').style.width = pct + '%';
    $('#rivalPct').textContent = pct + '%';
    $('#rivalStreak').textContent = currentStreak(S.rivalData, rTasks);
    $('#rivalWins').textContent = winCount(S.rivalData, rTasks);

    var mine = Math.round(score(S.data, S.user.tasks, today).pct * 100);
    var msg;
    if (!loggedDays(S.rivalData).length) {
      msg = Store.mode === 'cloud'
        ? r.name + ' hasn’t logged anything yet.'
        : r.name + '’s data lives on their device — connect Supabase to see it here.';
    } else if (mine > pct) msg = 'You’re ahead by ' + (mine - pct) + ' points today.';
    else if (pct > mine) msg = r.name + ' is ahead by ' + (pct - mine) + ' points today. Move.';
    else msg = 'Dead even today.';

    $('#rivalNote').textContent = msg;
  }

  /* ============================== EXTRAS ============================== */

  function maybeCelebrate() {
    var s = score(S.data, S.user.tasks, S.view);
    if (s.done === s.total && s.total > 0) {
      toast(S.user.theme === 'warrior' ? 'Full clear. Nothing left standing.' : 'Every petal open today. 🌸');
      var hero = $('.hero');
      hero.classList.remove('flash');
      void hero.offsetWidth;
      hero.classList.add('flash');
    }
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(function () { el.classList.add('in'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('in'); }, 2400);
  }

  /* ============================== START ============================== */

  Store.init().then(function () {
    initGate();

    var session = Store.getSession();
    if (session && CFG.users[session]) {
      boot(session);
    } else {
      document.body.classList.add('mode-gate');
    }
  });

})();
