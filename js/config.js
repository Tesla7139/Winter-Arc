/* =====================================================================
   WINTER ARC — config.js
   This is the ONLY file you need to edit for day-to-day changes:
   passcodes, task lists, the challenge dates, and Supabase keys.
   ===================================================================== */

window.WA_CONFIG = {

  /* ---------------------------------------------------------------
     THE CHALLENGE
     start : first day of the arc, YYYY-MM-DD
     days  : how long it runs
     winThreshold : fraction of tasks you must tick for the day to
                    count as "won" (0.8 = 80%). Streaks use this.
     --------------------------------------------------------------- */
  challenge: {
    start: '2026-09-01',
    days: 90,
    winThreshold: 0.8
  },

  /* ---------------------------------------------------------------
     SUPABASE  (optional — leave url/anonKey empty to stay on this
     device only. Fill them in and every tick syncs to the cloud and
     shows up for both of you. See sql/schema.sql + README.md)
     --------------------------------------------------------------- */
  supabase: {
    url: '',
    anonKey: '',
    table: 'winter_arc_days'
  },

  /* ---------------------------------------------------------------
     THE TWO OF YOU
     passcode : change these to whatever you want
     theme    : 'warrior' or 'bloom'
     tasks    : id must be unique + never change once you start
                logging, or old data loses its label.
                weekly: N  ->  target N times per week instead of daily
     --------------------------------------------------------------- */
  users: {

    sarthak: {
      id: 'sarthak',
      name: 'Sarthak',
      theme: 'warrior',
      passcode: 'ronin',
      rival: 'inan',
      tag: '01 // Discipline',
      line: 'Forge the body. Sharpen the mind. The winter does not negotiate.',
      listTitle: 'Daily protocol',
      noteTitle: 'War log',
      rivalTitle: 'The rival',
      tasks: [
        { id: 'skills',  name: 'Build skills' },
        { id: 'nojunk',  name: 'No junk food / no sugar' },
        { id: 'water',   name: '4L water' },
        { id: 'sleep',   name: '6–8 hours sleep' },
        { id: 'gym',     name: 'Gym', weekly: 5 },
        { id: 'run',     name: 'Run', weekly: 1 },
        { id: 'steps',   name: '10K steps' },
        { id: 'work',    name: 'Work' },
        { id: 'read',    name: 'Read a book · 30 min', weekly: 3 },
        { id: 'walk',    name: '20-minute walk, alone' },
        { id: 'cardio',  name: 'Cardio' },
        { id: 'protein', name: 'Protein intake' }
      ]
    },

    inan: {
      id: 'inan',
      name: 'Inan',
      theme: 'bloom',
      passcode: 'bloom',
      rival: 'sarthak',
      tag: '02 · Bloom',
      line: 'Soft heart, steady hands. Grow a little every single day.',
      listTitle: 'Today’s garden',
      noteTitle: 'Journal',
      rivalTitle: 'Partner in crime',
      tasks: [
        { id: 'sleep',    name: '6–7 hours sleep' },
        { id: 'nojunk',   name: 'No junk food' },
        { id: 'physics',  name: 'Physics' },
        { id: 'chem',     name: 'Chemistry' },
        { id: 'bio',      name: 'Biology' },
        { id: 'steps',    name: '10K steps' },
        { id: 'cardio',   name: 'Cardio' },
        { id: 'noscroll', name: 'No scrolling' },
        { id: 'water',    name: '3–4L water' },
        { id: 'bath',     name: 'Bath' },
        { id: 'pyq',      name: 'PYQ analysis' },
        { id: 'namaz',    name: 'Namaz' },
        { id: 'quran',    name: 'Quran' },
        { id: 'nomusic',  name: 'No music' },
        { id: 'journal',  name: 'Journaling' },
        { id: 'protein',  name: 'Protein intake' }
      ]
    }

  }
};
