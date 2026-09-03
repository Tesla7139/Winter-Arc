/* =====================================================================
   WINTER ARC — store.js
   One storage layer with two backends:

     local  -> localStorage. Works instantly, no setup, this device only.
     cloud  -> Supabase. Switched on automatically the moment you put a
               url + anonKey in config.js.

   localStorage is ALWAYS written first so the UI never waits on the
   network; the cloud write follows, and anything that fails is queued
   and retried on the next save or page load.

   Shape stored per user:
     { days: { "2026-09-03": { tasks: { gym: "done", run: "miss" },
                               meals: [ { slot: "lunch", text: "..." } ],
                               note: "..." } } }
   ===================================================================== */

(function () {
  'use strict';

  var LS_DATA    = 'winterarc.v1.data.';
  var LS_QUEUE   = 'winterarc.v1.queue';
  var LS_SESSION = 'winterarc.v1.session';

  var sb = null;
  var cloud = false;

  /* ------------------------------ helpers ------------------------------ */

  function cfg() { return window.WA_CONFIG || {}; }
  function table() { return (cfg().supabase && cfg().supabase.table) || 'winter_arc_days'; }

  function readLS(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('[WinterArc] could not write localStorage', e); return false; }
  }

  function emptyData() { return { days: {} }; }

  function localLoad(userId) {
    var d = readLS(LS_DATA + userId, null);
    if (!d || typeof d !== 'object' || !d.days) return emptyData();
    return d;
  }

  function localSave(userId, data) { writeLS(LS_DATA + userId, data); }

  /* --------------------------- pending queue --------------------------- */

  function queueGet() { var q = readLS(LS_QUEUE, []); return Array.isArray(q) ? q : []; }

  function queuePush(row) {
    var q = queueGet().filter(function (r) {
      return !(r.user_id === row.user_id && r.day === row.day);
    });
    q.push(row);
    writeLS(LS_QUEUE, q.slice(-500));
  }

  function flushQueue() {
    if (!cloud) return Promise.resolve();
    var q = queueGet();
    if (!q.length) return Promise.resolve();
    writeLS(LS_QUEUE, []);
    return sb.from(table()).upsert(q, { onConflict: 'user_id,day' }).then(function (res) {
      if (res && res.error) throw res.error;
    }).catch(function (err) {
      console.warn('[WinterArc] queue flush failed, will retry later', err);
      q.forEach(queuePush);
    });
  }

  /* -------------------------------- API -------------------------------- */

  var Store = {

    mode: 'local',

    /** Try to bring up Supabase. Always resolves — never blocks the app. */
    init: function () {
      var c = cfg().supabase || {};
      if (c.url && c.anonKey && window.supabase && window.supabase.createClient) {
        try {
          sb = window.supabase.createClient(c.url, c.anonKey, {
            auth: { persistSession: false }
          });
          cloud = true;
          Store.mode = 'cloud';
        } catch (e) {
          console.warn('[WinterArc] Supabase init failed, staying local', e);
          cloud = false;
          Store.mode = 'local';
        }
      }
      return Promise.resolve(Store.mode);
    },

    /** Read everything for one user. Cloud wins when reachable. */
    load: function (userId) {
      var local = localLoad(userId);
      if (!cloud) return Promise.resolve(local);

      return flushQueue()
        .then(function () {
          return sb.from(table()).select('day,tasks,meals,note').eq('user_id', userId);
        })
        .then(function (res) {
          if (res.error) throw res.error;
          var merged = { days: {} };
          (res.data || []).forEach(function (row) {
            merged.days[String(row.day).slice(0, 10)] = {
              tasks: row.tasks || {},
              meals: row.meals || [],
              note: row.note || ''
            };
          });
          // keep any day that only exists on this device
          Object.keys(local.days).forEach(function (d) {
            if (!merged.days[d]) merged.days[d] = local.days[d];
          });
          localSave(userId, merged);
          return merged;
        })
        .catch(function (err) {
          console.warn('[WinterArc] cloud read failed, using local copy', err);
          Store.mode = 'local (cloud offline)';
          return local;
        });
    },

    /** Persist one day. Local write is synchronous; cloud follows. */
    saveDay: function (userId, day, dayObj, fullData) {
      localSave(userId, fullData);
      if (!cloud) return Promise.resolve('local');

      var row = {
        user_id: userId,
        day: day,
        tasks: dayObj.tasks || {},
        meals: dayObj.meals || [],
        note: dayObj.note || '',
        updated_at: new Date().toISOString()
      };

      return sb.from(table()).upsert(row, { onConflict: 'user_id,day' })
        .then(function (res) {
          if (res.error) throw res.error;
          return 'cloud';
        })
        .catch(function (err) {
          console.warn('[WinterArc] cloud write queued for retry', err);
          queuePush(row);
          return 'queued';
        });
    },

    /* ----------------------------- session ----------------------------- */

    getSession: function () {
      var s = readLS(LS_SESSION, null);
      return s && s.user ? s.user : null;
    },

    setSession: function (userId) { writeLS(LS_SESSION, { user: userId, at: Date.now() }); },

    clearSession: function () { try { localStorage.removeItem(LS_SESSION); } catch (e) {} }
  };

  window.WA_Store = Store;
})();
