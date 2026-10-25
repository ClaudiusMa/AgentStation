// Cursor: composers in globalStorage/state.vscdb (cursorDiskKV composerData:<id>), plus
// running cursor-agent worker processes. The format is undocumented; expect breakage.
import { execFile } from 'node:child_process';
import { promises as fsp, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME, sqliteJson, clip } from './util.mjs';

const USER_DIR = path.join(HOME, 'Library', 'Application Support', 'Cursor', 'User');
export const CURSOR_DB = path.join(USER_DIR, 'globalStorage', 'state.vscdb');
const WORKSPACE_STORAGE = path.join(USER_DIR, 'workspaceStorage');

export const CURSOR_OPEN_MS = 60 * 60 * 1000;  // updated within this = open
export const CURSOR_WORKING_MS = 90 * 1000;    // updated within this = working (besides status 'generating')

const wsCache = new Map(); // workspace id -> folder | null

async function workspaceFolder(id) {
  if (!id || id === 'empty-window') return null;
  if (wsCache.has(id)) return wsCache.get(id);
  let folder = null;
  try {
    const j = JSON.parse(await fsp.readFile(path.join(WORKSPACE_STORAGE, id, 'workspace.json'), 'utf8'));
    const uri = j.folder || j.workspace;
    if (uri && uri.startsWith('file:')) {
      folder = fileURLToPath(uri);
      if (!j.folder) folder = path.dirname(folder); // a .code-workspace file
    }
  } catch {}
  wsCache.set(id, folder);
  return folder;
}

/** cursor-agent worker processes, by --worker-dir. Only the pid and that flag are kept:
 *  the command line also carries an API key, which must never leave this function. */
function cursorWorkers() {
  return new Promise((resolve) => {
    execFile('ps', ['-axo', 'pid=,etime=,command='], { maxBuffer: 16 * 1024 * 1024, timeout: 4000 }, (err, stdout) => {
      if (err) return resolve([]);
      const out = [];
      for (const line of stdout.split('\n')) {
        if (!/cursor-agent/.test(line) || !/\bworker start\b/.test(line)) continue;
        const pid = Number(line.trim().split(/\s+/)[0]);
        const etime = line.trim().split(/\s+/)[1];
        const m = line.match(/--worker-dir (.+?) --[a-z]/);
        if (pid && m) out.push({ pid, dir: m[1], startedAt: Date.now() - etimeMs(etime) });
      }
      resolve(out);
    });
  });
}

function etimeMs(s) {
  // [[dd-]hh:]mm:ss
  const m = String(s).match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/);
  if (!m) return 0;
  const [, d = 0, h = 0, mi, se] = m;
  return (((+d * 24 + +h) * 60 + +mi) * 60 + +se) * 1000;
}

/** Returns { agents, activity, workers }. */
export async function collectCursor(now = Date.now(), sinceMs = now - 24 * 3600e3) {
  const agents = [], activity = [];
  if (existsSync(CURSOR_DB)) {
    const since = Math.floor(sinceMs);
    // key range uses the primary-key index; json_extract keeps the large values in SQLite.
    const rows = await sqliteJson(
      CURSOR_DB,
      `select substr(key, 14) as id,
              json_extract(value, '$.name') as name,
              json_extract(value, '$.subtitle') as subtitle,
              json_extract(value, '$.status') as status,
              json_extract(value, '$.lastUpdatedAt') as lastUpdatedAt,
              json_extract(value, '$.createdAt') as createdAt,
              json_extract(value, '$.isDraft') as isDraft,
              json_extract(value, '$.workspaceIdentifier.uri.fsPath') as wsPath,
              json_extract(value, '$.workspaceIdentifier.id') as wsId,
              json_extract(value, '$.trackedGitRepos[0].repoPath') as repoPath,
              json_extract(value, '$.subagentComposerIds') as subagentIds,
              json_extract(value, '$.subComposerIds') as subIds,
              json_extract(value, '$.modelConfig.modelName') as model
         from cursorDiskKV
        where key >= 'composerData:' and key < 'composerData;'
          and json_extract(value, '$.lastUpdatedAt') >= ${since}`
    );
    const parentOf = new Map();
    for (const r of rows) {
      for (const list of [r.subagentIds, r.subIds]) {
        try { for (const c of JSON.parse(list || '[]')) parentOf.set(c, r.id); } catch {}
      }
    }
    for (const r of rows) {
      // Empty "New chat" drafts carry no work.
      if (!r.name && (r.status === 'none' || r.isDraft)) continue;
      const cwd = r.wsPath || (await workspaceFolder(r.wsId)) || r.repoPath || null;
      const lastActive = r.lastUpdatedAt || r.createdAt || 0;
      activity.push({ cwd, lastActive });
      if (now - lastActive > CURSOR_OPEN_MS) continue;
      const working = r.status === 'generating' || now - lastActive <= CURSOR_WORKING_MS;
      const parent = parentOf.get(r.id);
      agents.push({
        id: 'cursor:' + r.id,
        tool: 'cursor',
        title: clip(r.name || r.subtitle || 'Cursor chat'),
        cwd,
        status: working ? 'working' : 'idle',
        parentId: parent ? 'cursor:' + parent : null,
        startedAt: r.createdAt || null,
        lastActive,
        ...(r.model && r.model !== 'default' && { model: r.model }),
      });
    }
  }
  // Workers are idle hosts for Cursor background agents; their task state is not on disk,
  // so they are reported in sources rather than as passengers.
  const workers = (await cursorWorkers()).map((w) => ({ pid: w.pid, cwd: w.dir, startedAt: w.startedAt }));
  return { agents, activity, workers };
}
