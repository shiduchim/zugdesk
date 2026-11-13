// Which mode the app is in: Single Mode (one person looking) or Shadchan Mode.
// The choice is a device setting (Settings → Mode). Changing it reloads the app, so for
// as long as a page is open the mode never changes: every module can read these constants.
// No imports here on purpose: store.js, app.js and pages all read from this file.
const PREF_KEY = 'zugdesk.prefs';
function readMode() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}').mode === 'shadchan' ? 'shadchan' : 'single'; }
  catch { return 'single'; }
}
export const MODE = readMode();
export const isShadchan = MODE === 'shadchan';
export const MODES = [['single', 'Single'], ['shadchan', 'Shadchan']];
export const modeLabel = (m = MODE) => (MODES.find(x => x[0] === m) || MODES[0])[1];

// Saves the choice and restarts the app in the other mode (each mode has its own database).
export function switchMode(mode) {
  if (mode !== 'single' && mode !== 'shadchan') return;
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch {}
  p.mode = mode;
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {}
  location.hash = '#/home';
  location.reload();
}

// Where the list of people lives: Ideas in Single Mode; Guys or Girls in Shadchan Mode.
export function peopleListPath(kind) {
  if (!isShadchan) return '/people';
  return kind === 'girl' ? '/girls' : '/guys';
}
export const peopleListName = (kind) => (!isShadchan ? 'Ideas' : kind === 'girl' ? 'Girls' : 'Guys');
// Shadchan Mode: the list (Guys or Girls) the user was last in, so the bottom bar can light it up
// while a single's card or Add Person is open. Pages set it; app.js reads it.
export const listState = { last: '/guys' };
export function rememberList(kind) { if (kind === 'guy' || kind === 'girl') listState.last = peopleListPath(kind); }
