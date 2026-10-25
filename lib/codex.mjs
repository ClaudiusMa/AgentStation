// Codex: threads in ~/.codex/state_5.sqlite, turn state from each rollout .jsonl.
// Codex keeps threads forever and has no "closed" flag, so open/working are heuristics.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { HOME, sqliteJson, readHead, readTail, statOrNull, clip, promptTitle } from './util.mjs';

export const CODEX_DB = path.join(HOME, '.codex', 'state_5.sqlite');
export const CODEX_OPEN_MS = 60 * 60 * 1000;    // not archived and updated within this = open
export const CODEX_WORKING_MS = 10 * 60 * 1000; // a started turn only counts if the rollout moved this recently

const TURN_RE = /"type":"event_msg","payload":\{"type":"(task_started|task_complete|turn_aborted)"/g;
const turnCache = new Map();   // rollout path -> { key, running }
const parentCache = new Map(); // rollout path -> parent thread id | null

/** Is the last turn in the rollout started but not finished? */
async function turnRunning(file, st) {
  const key = st.mtimeMs + ':' + st.size;
  const c = turnCache.get(file);
  if (c && c.key === key) return c.running;
  let running = false;
  for (const bytes of [256 * 1024, 4 * 1024 * 1024]) {
    const text = await readTail(file, bytes, st.size);
    let last = null, m;
    TURN_RE.lastIndex = 0;
    while ((m = TURN_RE.exec(text))) last = m[1];
    if (last) { running = last === 'task_started'; break; }
    if (bytes >= st.size) break;
  }
  turnCache.set(file, { key, running });
  return running;
}

/** Parent from the rollout's session_meta (guardian reviews have no spawn edge). */
async function rolloutParent(file) {
  if (parentCache.has(file)) return parentCache.get(file);
  let parent = null;
  try {
    const first = (await readHead(file, 32 * 1024)).split('\n')[0];
    const m = first.match(/"parent_thread_id":"([^"]+)"/);
    if (m) parent = m[1];
  } catch {}
  parentCache.set(file, parent);
  return parent;
}

function titleFor(t) {
  if (t.name) return clip(t.name);
  const fromTitle = promptTitle(t.title);
  if (fromTitle && !/^#/.test(t.title)) return fromTitle;
  const fromPrompt = promptTitle(t.first_user_message);
  if (fromPrompt) return fromPrompt;
  if (t.agent_nickname) return clip(t.agent_nickname + (t.agent_path ? ' · ' + path.basename(t.agent_path) : ''));
  return fromTitle || 'Codex thread';
}

function parentFromSource(source) {
  try {
    const s = JSON.parse(source);
    return s?.subagent?.thread_spawn?.parent_thread_id || null;
  } catch { return null; }
}

/** Returns { agents, activity } where activity covers every thread touched since `sinceMs`. */
export async function collectCodex(now = Date.now(), sinceMs = now - 24 * 3600e3) {
  if (!existsSync(CODEX_DB)) return { agents: [], activity: [] };
  const since = Math.floor(sinceMs);
  const rows = await sqliteJson(
    CODEX_DB,
    `select t.id, t.rollout_path, t.cwd, t.title, t.name, t.archived, t.updated_at_ms, t.created_at_ms,
            t.source, t.thread_source, t.git_branch, t.model, t.agent_nickname, t.agent_role, t.agent_path,
            substr(t.first_user_message, 1, 400) as first_user_message, e.parent_thread_id as edge_parent
       from threads t left join thread_spawn_edges e on e.child_thread_id = t.id
      where coalesce(t.updated_at_ms, t.updated_at * 1000) >= ${since}
      order by t.updated_at_ms desc`
  );
  const agents = [], activity = [];
  for (const t of rows) {
    const st = t.rollout_path ? await statOrNull(t.rollout_path) : null;
    const lastActive = Math.round(Math.max(t.updated_at_ms || 0, st ? st.mtimeMs : 0));
    activity.push({ cwd: t.cwd, lastActive });
    if (t.archived || now - lastActive > CODEX_OPEN_MS) continue;
    let working = false;
    if (st && now - st.mtimeMs <= CODEX_WORKING_MS) {
      try { working = await turnRunning(t.rollout_path, st); } catch {}
    }
    const isSub = /subagent/.test(t.source || '') || t.thread_source === 'subagent' || t.thread_source === 'guardian_review';
    let parent = t.edge_parent || parentFromSource(t.source);
    if (!parent && isSub && st) parent = await rolloutParent(t.rollout_path);
    agents.push({
      id: 'codex:' + t.id,
      tool: 'codex',
      title: titleFor(t),
      cwd: t.cwd,
      status: working ? 'working' : 'idle',
      parentId: parent ? 'codex:' + parent : null,
      startedAt: t.created_at_ms || null,
      lastActive,
      ...(t.model && { model: t.model }),
      ...(t.git_branch && { branch: t.git_branch }),
      ...(t.agent_role && { agentType: t.agent_role }),
      ...(t.thread_source === 'guardian_review' && { agentType: 'guardian' }),
    });
  }
  return { agents, activity };
}
