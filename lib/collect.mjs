// One snapshot of every AI coding agent on this Mac. `node lib/collect.mjs` prints it.
import { fileURLToPath } from 'node:url';
import { projectFor } from './util.mjs';
import { collectClaudeAgents, collectClaudeActivity } from './claude.mjs';
import { collectCodex } from './codex.mjs';
import { collectCursor } from './cursor.mjs';

export const STATION_WINDOW_MS = 24 * 3600 * 1000; // a project with activity this recent keeps its station

const errMsg = (e) => String(e?.message || e).split('\n')[0].slice(0, 300);

async function guard(fn) {
  try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function collect(now = Date.now()) {
  const since = now - STATION_WINDOW_MS;
  const [claudeAgents, claudeActivity, codex, cursor] = await Promise.all([
    guard(() => collectClaudeAgents(now)),
    guard(() => collectClaudeActivity(since)),
    guard(() => collectCodex(now, since)),
    guard(() => collectCursor(now, since)),
  ]);

  const agents = [
    ...(claudeAgents.value || []),
    ...(codex.value?.agents || []),
    ...(cursor.value?.agents || []),
  ];
  const activity = [
    ...(claudeActivity.value || []),
    ...(codex.value?.activity || []),
    ...(cursor.value?.activity || []),
  ];

  // Project names; drop parent links to agents that are not open.
  const ids = new Set(agents.map((a) => a.id));
  for (const a of agents) {
    const p = a.cwd ? projectFor(a.cwd) : { project: a.tool === 'cursor' ? 'Cursor' : 'Unknown', root: null };
    a.project = p.project;
    a._root = p.root;
    if (a.parentId && !ids.has(a.parentId)) a.parentId = null;
  }

  const stations = new Map();
  const station = (project, root) => {
    let s = stations.get(project);
    if (!s) stations.set(project, (s = { project, cwd: root, lastActive: 0, working: 0, idle: 0, total: 0 }));
    if (!s.cwd && root) s.cwd = root;
    return s;
  };
  for (const act of activity) {
    if (act.lastActive < since) continue;
    const p = act.cwd ? projectFor(act.cwd) : { project: 'Cursor', root: null };
    const s = station(p.project, p.root);
    s.lastActive = Math.max(s.lastActive, act.lastActive);
  }
  for (const a of agents) {
    const s = station(a.project, a._root);
    s.lastActive = Math.max(s.lastActive, a.lastActive || 0);
    s[a.status] += 1;
    s.total += 1;
    delete a._root;
  }

  agents.sort((x, y) => x.project.localeCompare(y.project) || (y.lastActive || 0) - (x.lastActive || 0));

  const src = (r, count, extra = {}) => (r.ok ? { ok: true, count, ...extra } : { ok: false, count: 0, error: r.error });
  const claudeOk = claudeAgents.ok && claudeActivity.ok;
  return {
    generatedAt: now,
    agents,
    stations: [...stations.values()].sort((a, b) => b.lastActive - a.lastActive),
    sources: {
      claude: claudeOk
        ? { ok: true, count: claudeAgents.value.length }
        : { ok: false, count: claudeAgents.value?.length || 0, error: claudeAgents.error || claudeActivity.error },
      codex: src(codex, codex.value?.agents.length || 0),
      cursor: src(cursor, cursor.value?.agents.length || 0, cursor.ok ? { workers: cursor.value.workers.map((w) => ({ ...w, project: projectFor(w.cwd).project })) } : {}),
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  collect().then((s) => console.log(JSON.stringify(s, null, 2)), (e) => { console.error(e); process.exit(1); });
}
