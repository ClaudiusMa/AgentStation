// Shared helpers: read-only SQLite, partial file reads, project naming.
import { execFile } from 'node:child_process';
import { promises as fsp, existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();
const PRODUCTLAB = path.join(HOME, 'Documents', 'ProductLab');

/** Run a read-only query through the macOS sqlite3 CLI. Never a shell string. */
export function sqliteJson(dbPath, sql, { timeout = 8000 } = {}) {
  const run = (target) =>
    new Promise((resolve, reject) => {
      execFile('sqlite3', ['-readonly', '-json', target, sql], { maxBuffer: 64 * 1024 * 1024, timeout }, (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).trim()));
        const out = stdout.trim();
        try { resolve(out ? JSON.parse(out) : []); } catch (e) { reject(new Error('bad sqlite json: ' + e.message)); }
      });
    });
  return run(dbPath).catch(async (err) => {
    // A plain read-only open can fail with "unable to open database file" when the
    // directory is not writable for us (e.g. sandboxed) and the db is in rollback-journal
    // mode. immutable=1 reads without locks or side files. It is only safe without a WAL,
    // since immutable ignores the WAL and would show stale data.
    if (!/unable to open/i.test(err.message) || existsSync(dbPath + '-wal')) throw err;
    return run('file:' + encodeURI(dbPath) + '?immutable=1');
  });
}

/** First `bytes` of a file as utf8 (may cut the last line). */
export async function readHead(file, bytes = 256 * 1024) {
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally { await fh.close(); }
}

/** Last `bytes` of a file as utf8 (the first line may be partial). */
export async function readTail(file, bytes = 256 * 1024, size) {
  const fh = await fsp.open(file, 'r');
  try {
    if (size == null) size = (await fh.stat()).size;
    const start = Math.max(0, size - bytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, start);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally { await fh.close(); }
}

export async function statOrNull(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Collapse whitespace and cut to `n` characters. */
export function clip(s, n = 120) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** Pick a readable one-line title from a prompt that may start with pasted-file headers. */
export function promptTitle(s, n = 120) {
  if (!s) return '';
  const lines = String(s).split('\n').map((l) => l.trim()).filter(Boolean);
  const good = lines.find((l) => !/^(#|<|\/|-|\*|```)/.test(l));
  return clip(good || lines[0] || '', n);
}

// ---------- project naming ----------

const gitTopCache = new Map();
function gitToplevel(dir) {
  if (gitTopCache.has(dir)) return gitTopCache.get(dir);
  let cur = dir, found = null;
  while (cur && cur !== HOME && cur !== path.dirname(cur)) {
    try { statSync(path.join(cur, '.git')); found = cur; break; } catch {}
    cur = path.dirname(cur);
  }
  gitTopCache.set(dir, found);
  return found;
}

/** Map a cwd to { project, root }: display name plus the folder the station stands for. */
export function projectFor(cwd) {
  if (!cwd) return { project: 'Unknown', root: null };
  const p = path.resolve(cwd);
  if (p === HOME) return { project: 'Home', root: HOME };
  // the desktop app's worktrees live inside the repo they branch from; show the repo, not the lane's random name
  const wt = p.match(/^(.*)\/\.claude\/worktrees\/[^/]+/);
  if (wt) return projectFor(wt[1]);
  if (p.startsWith(PRODUCTLAB + path.sep)) {
    const [first, second] = p.slice(PRODUCTLAB.length + 1).split(path.sep);
    // lanes live in <Name>-worktrees/ or _worktrees/<Name>/
    const name = first === '_worktrees' && second ? second : first.replace(/-worktrees$/, '');
    return { project: name, root: path.join(PRODUCTLAB, name) };
  }
  const top = gitToplevel(p);
  if (top) return { project: path.basename(top), root: top };
  return { project: path.basename(p), root: p };
}
