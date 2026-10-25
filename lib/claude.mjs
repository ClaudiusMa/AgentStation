// Claude Code: live sessions from ~/.claude/sessions/<pid>.json, transcripts and
// sub-agent transcripts from ~/.claude/projects/<cwd-slug>/, and the desktop app's session list
// (~/Library/Application Support/Claude/claude-code-sessions/<account>/<org>/local_*.json) for
// sessions that aren't running but still need the user.
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { HOME, readHead, readTail, statOrNull, pidAlive, clip, promptTitle } from './util.mjs';

export const CLAUDE_DIR = path.join(HOME, '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const DESKTOP_DIR = path.join(HOME, 'Library', 'Application Support', 'Claude', 'claude-code-sessions');

export const CLAUDE_SUBAGENT_ACTIVE_MS = 2 * 60 * 1000; // sub-agent transcript touched this recently = running
const WORKING_STATUSES = new Set(['busy', 'running', 'working', 'generating', 'thinking']);

const slug = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

// Caches keyed by file path (+ mtime/size where content can change).
const headCache = new Map(); // path -> { cwd, firstPrompt }
const tailCache = new Map(); // path -> { key, model, branch }

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
  return '';
}

/** cwd and first real user prompt from the start of a transcript. */
async function transcriptHead(file) {
  if (headCache.has(file)) return headCache.get(file);
  let cwd = null, firstPrompt = null, full = false;
  try {
    const text = await readHead(file, 512 * 1024);
    full = text.length >= 500 * 1024;
    for (const line of text.split('\n')) {
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      if (!cwd && typeof d.cwd === 'string') cwd = d.cwd;
      if (!firstPrompt && d.type === 'user' && !d.isMeta && d.message?.role === 'user') {
        const t = textOf(d.message.content).trim();
        if (t && !t.startsWith('<') && !t.startsWith('Caveat:')) firstPrompt = t;
      }
      if (cwd && firstPrompt) break;
    }
  } catch {}
  const v = { cwd, firstPrompt };
  // Cache once both are known (or the head window is full and won't change); a brand-new
  // transcript may not have them yet, and small files are cheap to re-read.
  if ((cwd && firstPrompt) || full) headCache.set(file, v);
  return v;
}

/** Latest model and git branch from the end of a transcript. */
async function transcriptTail(file, st) {
  const key = st.mtimeMs + ':' + st.size;
  const c = tailCache.get(file);
  if (c && c.key === key) return c;
  let model, branch, lastText;
  try {
    const lines = (await readTail(file, 256 * 1024, st.size)).split('\n');
    for (let i = lines.length - 1; i >= 0 && !(model && branch && lastText); i--) {
      const line = lines[i];
      if (!line.includes('"type":"assistant"') && !line.includes('"gitBranch"')) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      if (!model && d.type === 'assistant' && d.message?.model && d.message.model !== '<synthetic>') model = d.message.model;
      if (!lastText && d.type === 'assistant' && !d.isSidechain) { const t = textOf(d.message?.content).trim(); if (t) lastText = t; }
      if (!branch && typeof d.gitBranch === 'string' && d.gitBranch) branch = d.gitBranch;
    }
  } catch {}
  const v = { key, model, branch, lastText };
  tailCache.set(file, v);
  return v;
}

async function readJson(p) {
  try { return JSON.parse(await fsp.readFile(p, 'utf8')); } catch { return null; }
}

async function subagentsFor(sessionDir, parentId, fallbackCwd, now) {
  const dir = path.join(sessionDir, 'subagents');
  let names;
  try { names = await fsp.readdir(dir); } catch { return []; }
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.jsonl')) continue;
    const file = path.join(dir, n);
    const st = await statOrNull(file);
    if (!st || now - st.mtimeMs > CLAUDE_SUBAGENT_ACTIVE_MS) continue;
    const agentId = n.replace(/^agent-/, '').replace(/\.jsonl$/, '');
    const meta = (await readJson(path.join(dir, n.replace(/\.jsonl$/, '.meta.json')))) || {};
    const head = await transcriptHead(file);
    const tail = await transcriptTail(file, st);
    out.push({
      id: 'claude:' + agentId,
      tool: 'claude',
      title: clip(meta.description || promptTitle(head.firstPrompt) || meta.agentType || 'Sub-agent'),
      cwd: head.cwd || fallbackCwd,
      status: 'working',
      parentId,
      startedAt: st.birthtimeMs ? Math.round(st.birthtimeMs) : null,
      lastActive: Math.round(st.mtimeMs),
      ...(tail.model && { model: tail.model }),
      ...(meta.agentType && { agentType: meta.agentType }),
    });
  }
  return out;
}

/** The desktop app's record of every Code-tab session, keyed by its CLI session id. Only the account in use:
 *  a Mac can hold an older signed-out account's folder too, whose sessions never show in the sidebar. */
async function desktopSessions() {
  const out = new Map();
  let accounts;
  try { accounts = await fsp.readdir(DESKTOP_DIR); } catch { return out; }
  const folders = [];
  for (const a of accounts) {
    let orgs; try { orgs = await fsp.readdir(path.join(DESKTOP_DIR, a)); } catch { continue; }
    for (const o of orgs) {
      const dir = path.join(DESKTOP_DIR, a, o);
      let names; try { names = (await fsp.readdir(dir)).filter((n) => /^local_.*\.json$/.test(n)); } catch { continue; }
      let newest = 0;
      for (const n of names) { const st = await statOrNull(path.join(dir, n)); if (st && st.mtimeMs > newest) newest = st.mtimeMs; }
      folders.push({ dir, names, newest });
    }
  }
  // the account in use is the one whose sessions were written most recently
  const cur = folders.sort((x, y) => y.newest - x.newest)[0];
  if (!cur) return out;
  for (const n of cur.names) {
    const r = await readJson(path.join(cur.dir, n));
    if (r && r.sessionId) out.set(r.cliSessionId || r.sessionId, r);
  }
  return out;
}
// The sidebar's "needs input" dot: something happened in the session after the user last looked at it.
// (Its "Mark as completed" lives in the app's own storage, which isn't read here.)
// What the session did last and what it needs from the user: the app's own turn summary when it has one
// (turnWrapUp from the wrap-up box, postTurnSummary written after each turn), else the transcript's last reply.
const firstLine = (t) => t && clip(t.replace(/[#*`>_]/g, '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0], 180);
function brief(r, lastText) {
  const w = r?.turnWrapUp || {}, pts = r?.postTurnSummary || {};
  const summary = w.description || pts.status_detail || firstLine(lastText) || null;
  const ask = w.needsUser || pts.needs_action || null;
  return {
    ...(summary && { summary: clip(summary, 220) }),
    ...(ask && { ask: clip(ask, 260) }),
    ...(pts.status_category && { state: pts.status_category }),
  };
}
const needsUser = (r) => !r.isArchived && (!r.lastFocusedAt || (r.lastActivityAt || 0) > r.lastFocusedAt + 1000);

/** Open agents (live pids) plus their running sub-agents, plus desktop sessions that still need the user. */
export async function collectClaudeAgents(now = Date.now()) {
  const desk = await desktopSessions();
  let files;
  try { files = await fsp.readdir(SESSIONS_DIR); } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const agents = [];
  for (const f of files) {
    if (!/^\d+\.json$/.test(f)) continue;
    const s = await readJson(path.join(SESSIONS_DIR, f));
    if (!s || !s.sessionId || !pidAlive(Number(s.pid))) continue;
    const cwd = s.cwd || HOME;
    const sessionDir = path.join(PROJECTS_DIR, slug(cwd), s.sessionId);
    const transcript = sessionDir + '.jsonl';
    const st = await statOrNull(transcript);
    let title = s.name;
    let model, branch, lastText;
    if (st) {
      if (!title) title = promptTitle((await transcriptHead(transcript)).firstPrompt);
      ({ model, branch, lastText } = await transcriptTail(transcript, st));
    }
    const rec = desk.get(s.sessionId);
    if (rec?.isArchived) continue;                       // archived in the app, even if its process is still up
    if (rec?.title) title = rec.title;
    const id = 'claude:' + s.sessionId;
    agents.push({
      id,
      tool: 'claude',
      title: clip(title || 'New session'),
      cwd,
      status: WORKING_STATUSES.has(String(s.status).toLowerCase()) ? 'working' : 'idle',
      parentId: null,
      startedAt: s.startedAt || null,
      lastActive: Math.round(Math.max(s.updatedAt || 0, s.statusUpdatedAt || 0, st ? st.mtimeMs : 0, s.startedAt || 0)),
      ...(model && { model }),
      ...(branch && branch !== 'HEAD' && { branch }),
      pid: s.pid,
      ...(s.entrypoint && { entrypoint: s.entrypoint }),
      ...brief(rec, lastText),
    });
    agents.push(...(await subagentsFor(sessionDir, id, cwd, now)));
  }
  // not running, but not resolved either: the sidebar still shows its dot
  const seen = new Set(agents.map((x) => x.id));
  for (const [cli, r] of desk) {
    const id = 'claude:' + cli;
    if (seen.has(id) || !needsUser(r) || !r.cwd) continue;
    let lastText;
    if (!r.turnWrapUp?.description && !r.postTurnSummary?.status_detail) {
      const t = path.join(PROJECTS_DIR, slug(r.cwd), cli + '.jsonl'), st = await statOrNull(t);
      if (st) ({ lastText } = await transcriptTail(t, st));
    }
    agents.push({
      id,
      tool: 'claude',
      title: clip(r.title || 'Session'),
      cwd: r.cwd,
      status: 'idle',
      parentId: null,
      startedAt: r.createdAt || null,
      lastActive: Math.round(r.lastActivityAt || r.createdAt || 0),
      ...(r.model && { model: r.model }),
      entrypoint: 'claude-desktop',
      ...brief(r, lastText),
    });
  }
  return agents;
}

/** Every transcript touched in the window, as { cwd, lastActive }, for stations of closed sessions. */
export async function collectClaudeActivity(sinceMs) {
  let dirs;
  try { dirs = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(PROJECTS_DIR, d.name);
    let names;
    try { names = await fsp.readdir(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue;
      const file = path.join(dir, n);
      const st = await statOrNull(file);
      if (!st || st.mtimeMs < sinceMs) continue;
      const { cwd } = await transcriptHead(file);
      if (cwd) out.push({ cwd, lastActive: Math.round(st.mtimeMs) });
    }
  }
  return out;
}
