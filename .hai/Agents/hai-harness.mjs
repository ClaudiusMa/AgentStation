#!/usr/bin/env node

import fs from "node:fs/promises";
import { createReadStream, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const runFile = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const packageRoot = path.resolve(scriptDirectory, "..");
const templateDirs = ["Agents", "Human"];
// HAI-Harness is a plugin: everything it ships or stores lives in one folder of
// the project. Outside that folder it owns only a marked block in the project's
// own AGENTS.md, which carries the always-loaded startup rules.
const harnessDirectory = ".hai";
const entryFile = "AGENTS.md";
const entryBlockSource = "scaffold/AGENTS.md";
const blockStart = "<!-- hai-harness:start -->";
const blockEnd = "<!-- hai-harness:end -->";
const blockNotice = "<!-- Managed by HAI-Harness: update rewrites everything between these markers. Keep your own instructions outside them. -->";
// Every version of every core file HAI-Harness has shipped (scripts/shipped-hashes.mjs).
// A core file is replaced only when it is one of these or the receipt's hash.
const shippedHashesSource = "scaffold/shipped-hashes.json";
// `init` and `update` install this very file into the project, so the lane and
// human-sync commands need no PATH entry, network or npm. The installed copy
// has no packaged templates, so it can never install or update anything.
const installedCliPath = "Agents/hai-harness.mjs";
const projectCliPath = `${harnessDirectory}/${installedCliPath}`;
const cliFile = { source: "bin/hai-harness.mjs", target: installedCliPath };
// `init` and `update` run only from the real package, identified positively:
// <package>/bin/hai-harness.mjs beside a package.json named hai-harness. Any
// other location (Agents/hai-harness.mjs in a project, .hai in this repository,
// a stray copy) is an installed copy and must never copy from its own parent.
const runsFromProject = (() => {
  if (path.basename(scriptDirectory) !== "bin" || path.basename(scriptPath) !== "hai-harness.mjs") return true;
  try { return JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")).name !== "hai-harness"; } catch { return true; }
})();
// Hints name the command form actually being run, relative to the working
// directory when the script is inside it (node Agents/hai-harness.mjs).
const cliCommand = (() => {
  let relative = "";
  try { relative = path.relative(process.cwd(), scriptPath); } catch {}
  const inside = relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  return `node ${shellWord((inside ? relative : scriptPath).split(path.sep).join("/"))}`;
})();
const upstreamCommand = "npx github:ClaudiusMa/HAI-Harness";
const templateFiles = [cliFile];
const ignoredNames = new Set([".DS_Store"]);
const taskBranchPrefix = "task/";
const taskMetadataKeys = {
  integration: "haiIntegrationBranch",
  base: "haiBaseCommit"
};
const legacyTaskBranchPrefix = "codex/";
const legacyTaskMetadataKeys = {
  integration: "codexIntegrationBranch",
  base: "codexBaseCommit"
};
const generatedTaskRoles = [
  { slug: "augustus", name: "Augustus" },
  { slug: "julius", name: "Julius" }
];

// Core files: shipped method files, paths relative to the harness folder.
// `update` refreshes one only while it still holds a version HAI-Harness
// shipped; a project's edit is kept and reported. Project-owned state is never
// overwritten by `update`.
const scaffoldPaths = [
  cliFile,
  ...[
  "Agents/check-for-update.mjs",
  "Agents/onboarding.md",
  "Agents/claudia.md",
  "Agents/augustus.md",
  "Agents/julius.md",
  "Agents/athena.md",
  "Agents/hephaestus.md",
  "Agents/momus.md",
  "Agents/designs/README.md",
  "Agents/handoffs/README.md",
  "Agents/handoffs/TEMPLATE.md",
  "Agents/_archive/README.md",
  "Agents/_archive/handoffs/README.md",
  "Agents/_archive/tasks/README.md",
  "Agents/tasks/TEMPLATE.md",
  "Agents/skills/implement/SKILL.md",
  "Agents/skills/debugging/SKILL.md",
  "Agents/lessons/README.md",
  "Agents/lessons/TEMPLATE.md",
  "Agents/skills/decision-logger/SKILL.md",
  "Agents/skills/human-scribe/SKILL.md",
  "Agents/skills/code-review/SKILL.md",
  "Agents/skills/guardian/SKILL.md",
  "Agents/skills/handoff/SKILL.md",
  "Agents/skills/traffic-control/SKILL.md",
  "Agents/skills/lesson-logger/SKILL.md",
  "Agents/skills/retrospective/SKILL.md",
  "Agents/custom/roles/README.md",
  "Agents/custom/skills/README.md",
  "Human/onboarding.md"
  ].map((relativePath) => ({ source: relativePath, target: relativePath }))
];
const corePaths = new Set(scaffoldPaths.map((item) => item.target));
// Shipped once, no longer: removed when untouched, kept and reported when edited.
const retiredPaths = ["AGENTS.md"];

// These files hold project-owned state after installation. `update` creates
// them only when absent.
const createOnlyPaths = ["Agents/lessons/INDEX.md"];
// Top-level Agents/*.md files that are project state or tombstones, not roles.
const projectStateDocs = new Set(["planning.md", "project_context.md", "design.md", "patterns.md", "graveyard.md", "decision-trail.md", "human-inbox.md"]);

// Projects extend the harness here; `update` never writes inside except the READMEs.
const customRolesPath = "Agents/custom/roles";
const customSkillsPath = "Agents/custom/skills";
const builtInRoles = ["claudia", "momus", "augustus", "julius", "athena", "hephaestus"];
const shippedSkillNames = new Set(scaffoldPaths.map((item) => item.target.match(/^Agents\/skills\/([^/]+)\/SKILL\.md$/)?.[1]).filter(Boolean));
const roleWriteLevels = ["code", "docs", "none"];

const decisionTrailPath = "decision-trail.md";
const humanInboxPath = "human-inbox.md";
// Starting content for a new task packet. It is embedded so the project copy of
// the CLI can run `human-sync init` without any packaged template files.
const packetTemplates = {
  [decisionTrailPath]: `# Decision Trail

## Format

### T{n}
- Date: YYYY-MM-DD
- Change: what changed, and in which file
- Why: reason
- Origin: user | agent
- Area: product | design | process | code
- Applies: approved {draft} (only when reflecting an approved item)

## Entries
`,
  [humanInboxPath]: `# Human Inbox

Captured through: none

## Format

### {decision | open question | brief | reflection | readme} \u00b7 from T{n}
- Status: pending | deferred
- Target: Human/decisions.md | Human/open_questions.md | Human/brief.md | Human/reflections.md | README.md
- Draft: proposed text for explicit batch approval

## Drafts
`
};
const captureAreas = new Set(["product", "design", "process"]);
// Same set the trail duty covers. Role docs are the ones named in the
// onboarding role index, plus the project's custom roles. The trail, the
// inbox, task contracts, and handoffs are excluded on purpose.
const roleDocs = [
  ...builtInRoles.map((role) => `Agents/${role}.md`),
  customRolesPath
];
// Traced after packets already existed: an older packet has no hash for them,
// which reads as drift until an ordinary trace acknowledgment adopts it.
const laterTracedPaths = new Set(["Agents/momus.md", customRolesPath]);
const tracedPaths = [
  "Agents/planning.md",
  "Agents/project_context.md",
  "Agents/design.md",
  "Agents/designs",
  ...roleDocs
];

// Mandatory startup context should stay current and scannable. These budgets
// are intentionally generous; they catch history dumps without constraining
// normal project detail.
const promptHygieneLimits = new Map([
  ["Agents/planning.md", 1200],
  ["Agents/tasks/augustus.md", 400],
  ["Agents/tasks/julius.md", 400]
]);

// Cloud-sync tools (iCloud Drive and similar) leave duplicates named "<name> <N>"
// ("index 2", "refs/heads/task/x 2", "notes 2.md") when two devices write one
// file. Git reads some of them: a ref copy surfaces as "bad object". The sweep
// moves only provably redundant copies to a reversible quarantine and reports
// the rest. It never deletes data and never touches tracked files.
const conflictCopyName = /^(.+) (?:[2-9]|[1-9]\d)(\.[^ /]+)?$/;
const gitIndexCopy = /^(?:(?:worktrees|modules)\/[^/]+\/)*index \d+$/;
const gitRefCopy = /^(?:worktrees\/[^/]+\/)?refs\//;
const gitHeadCopy = /(?:^|\/)HEAD \d+$/;
const gitWorktreeCopy = /^worktrees\/[^/]+$/;
const packetDirectoryCopy = /^hai-harness\/tasks\/[^/]+$/;
const compareNext = "Compare the two and ask the user which one is right; nothing is moved or deleted for you.";
const missingNext = "Ask the user before renaming it to the original name or moving it away; it may hold the only copy.";
const quarantineAdvice = `"${cliCommand} worktree sweep --quarantine <path>" moves one copy aside to the same reversible quarantine, but only for a path the user explicitly approved`;

const usage = `HAI-Harness

Usage:
  ${cliCommand} init              [--target <project>] [--force] [--dry-run]
  ${cliCommand} update            [--target <project>] [--dry-run] [--accept-upstream <path>]... [--default-role <role>]
  ${cliCommand} migrate           [--target <project>] [--dry-run]
  ${cliCommand} doctor            [--target <project>]
  ${cliCommand} human-sync        [capture|status|init|acknowledge|checkpoint] [--target <dir>]
    init [--migrate]
    acknowledge --through T<n> --head <HEAD> --snapshot <digest>
    checkpoint --output <file>
  ${cliCommand} worktree create   <task-slug> [--integration <branch>] [--target <dir>]
  ${cliCommand} worktree status   [--all] [--target <dir>]
  ${cliCommand} worktree approve  --approved <message> [--keep-worktree] [--target <dir>]
  ${cliCommand} worktree cleanup  <task-branch> [--target <dir>]
  ${cliCommand} worktree sweep    [--quarantine <path>] [--target <dir>]
  ${cliCommand} help

Commands:
  init       Install HAI-Harness into ${harnessDirectory}/ of an existing project, including this CLI as
             ${projectCliPath}, and add the HAI-Harness block to the project's own ${entryFile}
             (created when missing). Nothing else outside ${harnessDirectory}/ is written.
  update     Refresh core method files and the ${entryFile} block; create missing generic infrastructure.
             A core file is replaced only while it holds a version HAI-Harness shipped: a file the
             project edited is kept and reported until --accept-upstream names it. Never touches
             project-owned planning, context, task, handoff, lesson, Human or custom/ content, or
             anything in ${entryFile} outside the block.
             On an older root-layout install (Agents/, Human/ at the project root), update first
             moves it into ${harnessDirectory}/ (needs a clean Git checkout); custom files are reported.
  migrate    Only the move that update performs for a root-layout install.
             init, update and migrate need the packaged templates: run them as
             ${upstreamCommand} <init|update|migrate>
             (the project copy of this CLI refuses them and prints that form).
  doctor     Check the installed files, the ${entryFile} block, edited core files and custom
             roles and skills, and report cloud-sync conflict copies ("<name> <N>") without
             moving anything.
  human-sync List decision-trail entries after the inbox cursor that the user should review.
             Read-only; makes no model or network call.
  worktree   Create, inspect, or explicitly approve a native Git task lane.
             create, approve, cleanup and sweep first move redundant cloud-sync conflict
             copies ("<name> <N>") to a reversible quarantine under the Git common dir.
             Nothing is deleted; copies that differ are kept and reported. approve also
             refuses while a kept copy sits in the lane it would commit.

Options:
  --target <dir>       Project root (init, update, migrate, doctor) or checkout directory. Defaults to
                       the current directory. human-sync resolves a project root to its ${harnessDirectory}/ folder.
  --force              (init only) Overwrite existing harness files.
  --dry-run            (init/update/migrate only) Show what would change without writing files.
  --default-role <role> (init/update/migrate) Who answers a message that names no HAI role: claudia,
                       own (the project's own AGENTS.md instructions; HAI applies only when a HAI
                       role is named), or a custom role. Stored once in the AGENTS.md block marker.
                       First install: own when the project already had an AGENTS.md, else claudia.
  --accept-upstream <path>
                       (update only, repeatable) Replace this one edited core file, such as
                       Agents/onboarding.md, with the shipped version.
  --integration <name> (worktree create only) Local branch to integrate into. Defaults to the
                       branch checked out in the primary checkout, including main.
  --all                (worktree status only) List every task lane, how far behind it is,
                       and which changed files it shares with other lanes.
  --approved <message> (worktree approve only) Explicit approval and commit message.
  --keep-worktree      (worktree approve only) Retain the lane for authorized outward work,
                       ongoing preview, or follow-up; run cleanup after verified completion.
  --quarantine <path>  (worktree sweep only) Move one named conflict copy that the sweep kept into
                       the reversible quarantine. Use it only for a path the user approved. A
                       relative path is resolved against --target (default: the current directory).
`;

main().catch((error) => {
  console.error(`hai-harness: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage);
    return;
  }

  if (runsFromProject && (command === "init" || command === "update" || command === "migrate")) {
    throw new Error(`${command} copies the packaged templates, which this project copy of the CLI does not carry. Run it from the published package instead:\n  ${upstreamCommand} ${[command, ...args].map(shellWord).join(" ")}`);
  }

  if (command === "worktree") {
    await worktree(args);
    return;
  }

  if (command === "human-sync") {
    await humanSyncCommand(args);
    return;
  }
  const options = parseOptions(args, new Set(["--target", "--force", "--dry-run", "--accept-upstream", "--default-role"]));
  rejectOption(options.acceptUpstream.length > 0 && command !== "update", "--accept-upstream is only valid with update.");
  rejectOption(options.defaultRole !== undefined && command === "doctor", "--default-role is only valid with init, update and migrate.");
  if (["init", "update", "migrate"].includes(command)) await assertDefaultRole(options.target, options);
  if (command === "init") {
    await init(options);
    return;
  }
  if (command === "update") {
    rejectOption(options.force, "--force is only valid with init.");
    await update(options);
    return;
  }
  if (command === "migrate") {
    rejectOption(options.force, "--force is only valid with init.");
    await migrate(options);
    return;
  }
  if (command === "doctor") {
    rejectOption(options.force || options.dryRun, "doctor accepts only --target.");
    await doctor(options);
    return;
  }

  throw new Error(`Unknown command "${command}". Run "${cliCommand} help".`);
}

function parseOptions(args, allowed) {
  const options = {
    target: process.cwd(),
    force: false,
    dryRun: false,
    all: false,
    integration: undefined,
    approved: undefined,
    acceptUpstream: [],
    positional: []
  };
  const valueOptions = new Map([
    ["--target", "target"],
    ["--integration", "integration"],
    ["--approved", "approved"],
    ["--through", "through"],
    ["--head", "head"],
    ["--snapshot", "snapshot"],
    ["--output", "output"],
    ["--quarantine", "quarantine"],
    ["--default-role", "defaultRole"]
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force" || arg === "--dry-run" || arg === "--migrate" || arg === "--all" || arg === "--keep-worktree") {
      if (!allowed.has(arg)) throw new Error(`Unknown option "${arg}".`);
      options[{ "--force": "force", "--migrate": "migrate", "--all": "all", "--keep-worktree": "keepWorktree" }[arg] || "dryRun"] = true;
      continue;
    }
    if (arg === "--accept-upstream") {
      if (!allowed.has(arg)) throw new Error(`Unknown option "${arg}".`);
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      options.acceptUpstream.push(value);
      index += 1;
      continue;
    }
    if (valueOptions.has(arg)) {
      if (!allowed.has(arg)) throw new Error(`Unknown option "${arg}".`);
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      options[valueOptions.get(arg)] = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown option "${arg}".`);
    options.positional.push(arg);
  }

  options.target = path.resolve(options.target);
  return options;
}

function rejectOption(condition, message) {
  if (condition) throw new Error(message);
}

function shellWord(word) {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : JSON.stringify(word);
}

async function init(options) {
  assertProjectRoot(options.target, "init");
  await assertDirectory(options.target);
  const layout = await layoutOf(options.target);
  if (layout.kind === "legacy" || layout.kind === "partial") throw new Error(legacyLayoutMessage(options.target, layout.kind));
  const harness = layout.harness;
  await chooseDefaultRole(options);
  const receipt = await readReceipt(harness);
  const install = { ...options, base: options.target };
  const results = { created: [], overwritten: [], skipped: [] };
  for (const dir of templateDirs) {
    await copyDirectory(path.join(packageRoot, dir), path.join(harness, dir), install, results);
  }
  for (const file of templateFiles) {
    await copyFile(path.join(packageRoot, file.source), path.join(harness, file.target), install, results);
  }
  for (const role of generatedTaskRoles) {
    await generateTaskFile(role, { ...install, target: harness }, results, options.force);
  }
  results.entry = await refreshEntryBlock(options.target, options, { adopt: true });
  if (!options.dryRun) {
    await saveReceipt(harness, receipt, { block: Boolean(receipt.block || results.entry.installed), files: await installedCoreHashes(harness, receipt) });
  }
  printInitSummary(options.target, options, results);
}

async function update(options) {
  assertProjectRoot(options.target, "update");
  await assertDirectory(options.target);
  const layout = await layoutOf(options.target);
  // An install from before the plugin layout moves into .hai/ as part of the
  // update, with migrate's safety checks; nothing extra for the user to run.
  if (layout.kind === "legacy" || layout.kind === "partial") {
    await migrate(options);
    return;
  }
  if (layout.kind === "none") {
    throw new Error(`HAI-Harness is not installed in ${options.target}. Install it with:\n  ${upstreamCommand} init --target ${shellWord(options.target)}`);
  }
  const results = await refreshHarness(options.target, layout.harness, options);
  printUpdateSummary(options.target, options, results);
}

// Refreshes core files, generic infrastructure and the AGENTS.md block of an
// install whose harness folder is `harness`. `readRoot` is where the files sit
// now; it differs from `harness` only for a migrate dry run, which classifies
// the root-layout files as if they had already moved.
async function refreshHarness(projectRoot, harness, options, { readRoot = harness, entry, adoptEntry } = {}) {
  const results = { created: [], updated: [], accepted: [], kept: [], current: [], retired: [], retiredKept: [], preserved: [], missingSource: [], entry: null };
  const receipt = await readReceipt(readRoot);
  const shipped = await readShippedHashes();
  const accept = new Set(options.acceptUpstream.map((item) => item.replaceAll("\\", "/").replace(/^\.\//, "").replace(new RegExp(`^${harnessDirectory}/`), "")));
  for (const relativePath of accept) {
    if (!corePaths.has(relativePath)) throw new Error(`--accept-upstream takes a core file such as Agents/onboarding.md; ${relativePath} is not one.`);
  }
  // Add a missing block only to an install that predates it: an old receipt or
  // the retired whole-file entry. A missing receipt (often gitignored, so absent
  // on a fresh clone) never re-adds a block the project removed.
  const predatesBlock = adoptEntry ?? (receipt.block === undefined && (receipt.installedVersion !== undefined || await exists(path.join(harness, "AGENTS.md"))));
  const files = { ...(receipt.files ?? {}) };
  for (const { source, target } of scaffoldPaths) {
    const sourcePath = path.join(packageRoot, source);
    if (!(await exists(sourcePath))) {
      results.missingSource.push(source);
      continue;
    }
    const upstreamHash = contentHash(await fs.readFile(sourcePath));
    const current = await readOptional(path.join(readRoot, target));
    const shown = shownPath(projectRoot, harness, target);
    if (current === null) results.created.push(shown);
    else if (contentHash(current) === upstreamHash) results.current.push(shown);
    else if (accept.has(target)) results.accepted.push(shown);
    else if (wasShipped(shipped, receipt, target, contentHash(current))) results.updated.push(shown);
    else {
      results.kept.push(shown);
      continue;
    }
    files[target] = upstreamHash;
    if (!options.dryRun && (current === null || contentHash(current) !== upstreamHash)) {
      await fs.mkdir(path.dirname(path.join(harness, target)), { recursive: true });
      await fs.copyFile(sourcePath, path.join(harness, target));
    }
  }
  for (const relativePath of createOnlyPaths) {
    const shown = shownPath(projectRoot, harness, relativePath);
    if (await exists(path.join(readRoot, relativePath))) {
      results.preserved.push(shown);
      continue;
    }
    results.created.push(shown);
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(path.join(harness, relativePath)), { recursive: true });
      await fs.copyFile(path.join(packageRoot, relativePath), path.join(harness, relativePath));
    }
  }
  for (const role of generatedTaskRoles) {
    await generateTaskFile(role, { ...options, target: readRoot, base: projectRoot, shownAs: harness }, results, false);
  }
  for (const relativePath of retiredPaths) {
    const file = path.join(harness, relativePath);
    const current = await readOptional(file);
    if (current === null) continue;
    const shown = shownPath(projectRoot, harness, relativePath);
    if (wasShipped(shipped, receipt, relativePath, contentHash(current))) {
      results.retired.push(shown);
      if (!options.dryRun) await fs.unlink(file);
    } else {
      results.retiredKept.push(shown);
    }
  }
  results.entry = entry ?? await refreshEntryBlock(projectRoot, options, { adopt: predatesBlock });
  if (!options.dryRun) await saveReceipt(harness, receipt, { block: Boolean(receipt.block || results.entry.installed), files });
  return results;
}

// Moves a root-layout install into the harness folder, then refreshes it like
// `update`. Files the harness cannot classify are reported, never moved. A move
// that stopped partway resumes with the pieces still at the root.
async function migrate(options) {
  assertProjectRoot(options.target, "migrate");
  await assertDirectory(options.target);
  const root = options.target;
  const layout = await layoutOf(root);
  if (layout.kind === "plugin") {
    console.log(`HAI-Harness already lives in ${harnessDirectory}/ in ${root}; nothing to migrate.`);
    return;
  }
  if (layout.kind === "none") throw new Error(`No HAI-Harness install found in ${root}.`);
  const harness = path.join(root, harnessDirectory);
  const moves = [];
  const both = [];
  for (const name of [...templateDirs, ".hai-harness.json"]) {
    if (!(await exists(path.join(root, name)))) continue;
    if (await exists(path.join(harness, name))) both.push(name);
    else moves.push(name);
  }
  if (both.length > 0) throw new Error(`${both.map((name) => `${name} and ${harnessDirectory}/${name}`).join(", ")} both exist. Reconcile each pair by hand (keep one), then run migrate again; nothing was moved.`);
  const gitRoot = await gitOptional(root, ["rev-parse", "--show-toplevel"]);
  if (gitRoot) {
    const dirty = await dirtyPaths(root);
    if (dirty.length > 0) throw new Error(`migrate needs a clean checkout so the move can be reviewed on its own. Commit or set aside first: ${dirty.slice(0, 5).join(", ")}${dirty.length > 5 ? ", ..." : ""}`);
  }
  // Ignore rules anchored at the old paths stop matching after the move, and
  // approve would then commit those files. Find them before moving anything.
  const exposed = [];
  if (gitRoot && moves.length > 0) {
    const ignored = (await gitOptional(root, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "--", ...moves])).split("\n").filter(Boolean);
    const moved = ignored.map((item) => `${harnessDirectory}/${item}`);
    const still = moved.length === 0 ? "" : await runFile("git", ["check-ignore", "--", ...moved], { cwd: root, maxBuffer: 1024 * 1024 }).then((result) => result.stdout, (error) => error.stdout ?? "");
    const stillIgnored = new Set(still.split("\n").filter(Boolean));
    exposed.push(...moved.filter((item) => !stillIgnored.has(item)));
  }
  if (exposed.length > 0 && !options.dryRun) {
    throw new Error(`These files are gitignored now but would not be after the move, so approve would commit them:\n${exposed.map((item) => `  - ${item}`).join("\n")}\nAdd ignore rules for the ${harnessDirectory}/ paths to .gitignore and commit that first; nothing was moved.`);
  }
  const agentsAtRoot = moves.includes("Agents");
  const report = await migrationReport(root, gitRoot, agentsAtRoot ? root : harness);
  report.exposed = exposed;
  const entryContent = await readOptional(path.join(root, entryFile));
  const shippedEntry = entryContent !== null && ((await readShippedHashes())[entryFile] ?? []).includes(contentHash(entryContent));
  report.entryReview = entryContent !== null && !shippedEntry && findEntryBlock(entryContent.toString("utf8")).state === "none";
  if (!options.dryRun) {
    await fs.mkdir(harness, { recursive: true });
    for (const name of moves) {
      const tracked = gitRoot ? await git(root, ["ls-files", "--", name]) : "";
      if (tracked) await git(root, ["mv", "-k", name, `${harnessDirectory}/${name}`]);
      // git mv carries tracked files; ignored or untracked ones follow on disk.
      await moveRemaining(path.join(root, name), path.join(harness, name));
    }
  }
  const entry = shippedEntry ? await refreshEntryBlock(root, options, { adopt: true, replaceWhole: true }) : undefined;
  const results = await refreshHarness(root, harness, options, { readRoot: options.dryRun && agentsAtRoot ? root : harness, entry, adoptEntry: true });
  printMigrateSummary(root, options, moves, results, report);
}

async function moveRemaining(source, destination) {
  const stat = await fs.lstat(source).catch(() => null);
  if (!stat) return;
  if (!stat.isDirectory()) {
    if (await exists(destination)) throw new Error(`Cannot move ${source}: ${destination} already exists.`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(source, destination);
    return;
  }
  if (!(await exists(destination))) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(source, destination);
    return;
  }
  for (const child of await fs.readdir(source)) await moveRemaining(path.join(source, child), path.join(destination, child));
  await fs.rmdir(source);
}

async function migrationReport(root, gitRoot, agentsBase) {
  const agents = path.join(agentsBase, "Agents");
  const roles = [];
  const skills = [];
  for (const entry of await fs.readdir(agents, { withFileTypes: true }).catch(() => [])) {
    if (entry.isFile() && entry.name.endsWith(".md") && !corePaths.has(`Agents/${entry.name}`) && !projectStateDocs.has(entry.name)) roles.push(`${harnessDirectory}/Agents/${entry.name}`);
  }
  for (const entry of await fs.readdir(path.join(agents, "skills"), { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory() && !shippedSkillNames.has(entry.name)) skills.push(`${harnessDirectory}/Agents/skills/${entry.name}`);
  }
  const oldCommand = /node Agents\/(?:hai-harness|check-for-update)\.mjs/;
  const stale = [];
  const entry = await readOptional(path.join(root, entryFile));
  if (entry !== null && oldCommand.test(withoutEntryBlock(entry.toString("utf8")))) stale.push(entryFile);
  const scan = async (directory, relative) => {
    for (const item of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const childRelative = `${relative}/${item.name}`;
      if (item.isDirectory()) await scan(path.join(directory, item.name), childRelative);
      else if (item.name.endsWith(".md") && !corePaths.has(childRelative) && oldCommand.test(await fs.readFile(path.join(directory, item.name), "utf8"))) stale.push(`${harnessDirectory}/${childRelative}`);
    }
  };
  await scan(agents, "Agents");
  const lanes = gitRoot
    ? (await listWorktrees(root)).filter((item) => item.branch.startsWith(taskBranchPrefix) && !samePath(item.root, gitRoot)).map((item) => item.branch)
    : [];
  return { roles, skills, stale, lanes };
}

// The HAI-Harness source repository keeps its templates in Agents/ and Human/
// at its root; those are never a root-layout install.
async function layoutOf(projectRoot) {
  const harness = path.join(projectRoot, harnessDirectory);
  const packageSource = await readJson(path.join(projectRoot, "package.json")).then((value) => value.name === "hai-harness", () => false);
  const rootInstall = !packageSource && (await exists(path.join(projectRoot, "Agents/onboarding.md")) || await exists(path.join(projectRoot, "Human/onboarding.md")) || await exists(path.join(projectRoot, ".hai-harness.json")));
  // Both places hold harness files when a migrate stopped partway.
  if (await exists(path.join(harness, "Agents"))) return { kind: rootInstall ? "partial" : "plugin", harness };
  if (rootInstall) return { kind: "legacy", harness: projectRoot };
  return { kind: "none", harness };
}

function assertProjectRoot(target, command) {
  if (path.basename(target) === harnessDirectory) {
    throw new Error(`${command} takes the project root, not its ${harnessDirectory}/ folder: --target ${shellWord(path.dirname(target))}`);
  }
}

function legacyLayoutMessage(root, kind = "legacy") {
  return [
    kind === "partial"
      ? `A move of HAI-Harness into ${harnessDirectory}/ in ${root} stopped partway: harness files are both in ${harnessDirectory}/ and at the project root.`
      : `HAI-Harness is installed in ${root} in the old root layout (Agents/ and Human/ at the project root). It now lives in ${harnessDirectory}/ and owns only a marked block in your ${entryFile}.`,
    `Nothing was changed. From a clean task lane, update moves it (preview first):`,
    `  ${upstreamCommand} update --dry-run --target ${shellWord(root)}`,
    `  ${upstreamCommand} update --target ${shellWord(root)}`
  ].join("\n");
}

// Human-sync works on the harness folder; a project root resolves to it.
async function harnessRootFor(target) {
  return (await exists(path.join(target, harnessDirectory, "Agents"))) ? path.join(target, harnessDirectory) : target;
}

function shownPath(projectRoot, harness, relativePath) {
  return path.relative(projectRoot, path.join(harness, relativePath)).split(path.sep).join("/");
}

async function readOptional(file) {
  return fs.readFile(file).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

// Without the list nothing counts as shipped, so every differing file is kept.
async function readShippedHashes() {
  return (await readJson(path.join(packageRoot, shippedHashesSource)).catch(() => ({}))).hashes ?? {};
}

function wasShipped(shipped, receipt, relativePath, hash) {
  return (shipped[relativePath] ?? []).includes(hash) || receipt.files?.[relativePath] === hash;
}

// After init, a core file belongs to the harness only while it matches what this
// package ships; a kept edit keeps its earlier recorded hash, if any.
async function installedCoreHashes(harness, receipt) {
  const files = { ...(receipt.files ?? {}) };
  for (const { source, target } of scaffoldPaths) {
    const current = await readOptional(path.join(harness, target));
    const upstream = await readOptional(path.join(packageRoot, source));
    if (current !== null && upstream !== null && contentHash(current) === contentHash(upstream)) files[target] = contentHash(upstream);
  }
  return files;
}

async function readReceipt(harness) {
  return readJson(path.join(harness, ".hai-harness.json")).catch(() => ({}));
}

async function saveReceipt(harness, receipt, changes) {
  const statePath = path.join(harness, ".hai-harness.json");
  const packageMetadata = await readJson(path.join(packageRoot, "package.json"));
  const state = {
    ...receipt,
    schemaVersion: 1,
    installedVersion: packageMetadata.version,
    channel: typeof receipt.channel === "string" ? receipt.channel : "stable",
    checkEnabled: receipt.checkEnabled !== false,
    ...changes
  };
  await fs.mkdir(harness, { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporaryPath, statePath);
}

// What a message that names no HAI role gets: "claudia", "own" (the project's
// own instructions; HAI applies only when a HAI role is named) or a custom role.
// It lives in the start marker, so it is set once, travels with the tracked
// AGENTS.md, and costs agents nothing beyond the block they already read.
const startMarker = /^\uFEFF?<!-- hai-harness:start(?: default=([a-z][a-z0-9-]*))? -->[ \t\r]*$/gm;
const startSteps = "Do these in order, before anything else.";
const claudiaDefault = "Otherwise you are Claudia, even for a plain coding request; do not ask the user to pick.";

function renderEntryBlock(body, defaultRole) {
  let text = body.trim();
  const swap = (from, to) => {
    if (!text.includes(from)) throw new Error(`${entryBlockSource} no longer contains "${from}"; update renderEntryBlock.`);
    text = text.replace(from, to);
  };
  if (defaultRole === "own") {
    swap(startSteps, "When the user's message or your task contract names a HAI role (step 2), do these in order, before anything else. When it names none, this block does not apply: follow this project's own instructions outside it.");
    swap(claudiaDefault, "Otherwise no HAI role applies; do not take one or ask the user to pick.");
  } else if (defaultRole !== "claudia") {
    const name = `${defaultRole[0].toUpperCase()}${defaultRole.slice(1)}`;
    swap(claudiaDefault, `Otherwise you are ${name}, this project's default role (\`.hai/Agents/custom/roles/${defaultRole}.md\`), even for a plain coding request; do not ask the user to pick.`);
  }
  return `<!-- hai-harness:start default=${defaultRole} -->\n${blockNotice}\n\n${text}\n${blockEnd}\n`;
}

function findEntryBlock(content) {
  const ends = [...content.matchAll(new RegExp(`^${blockEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t\\r]*$`, "gm"))];
  const starts = [...content.matchAll(startMarker)];
  if (starts.length === 0 && ends.length === 0) return { state: "none" };
  if (starts.length !== 1 || ends.length !== 1 || ends[0].index < starts[0].index) return { state: "malformed" };
  let end = ends[0].index + ends[0][0].length;
  if (content[end] === "\n") end += 1;
  // A byte-order mark before the first marker stays in place. A marker
  // written before defaults existed means Claudia.
  return { state: "one", start: starts[0].index + (starts[0][0].startsWith("\uFEFF") ? 1 : 0), end, defaultRole: starts[0][1] ?? "claudia" };
}

function describeDefault(defaultRole) {
  if (defaultRole === "claudia") return "Claudia";
  if (defaultRole === "own") return "this project's own instructions (HAI applies only when a HAI role is named)";
  return `the custom role ${defaultRole}`;
}

// A project with no AGENTS.md of its own has no workflow to keep, so the user
// decides whether Claudia answers unnamed messages. Only a person at a terminal
// can answer; an agent or script is told to ask the user and pass the choice.
async function chooseDefaultRole(options) {
  if (options.defaultRole !== undefined) return;
  const raw = await readOptional(path.join(options.target, entryFile));
  const content = raw === null ? "" : raw.toString("utf8");
  if (findEntryBlock(content).state !== "none" || withoutEntryBlock(content).trim() !== "") return;
  const question = `This project has no ${entryFile} of its own. Should agents answer any message that names no role as Claudia, HAI-Harness's lead, who plans and builds under its rules (lanes, clean main, approvals)?`;
  if (options.dryRun) {
    console.log(`${question}\n(init will ask this; the dry run assumes yes.)\n`);
    options.defaultRole = "claudia";
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${question}\nAsk the user, then run init again with their answer; nothing was written:\n  ${upstreamCommand} init --default-role claudia   (yes: Claudia answers)\n  ${upstreamCommand} init --default-role own       (no: HAI applies only when a HAI role is named)`);
  }
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (await prompt.question(`${question} [y/n] `)).trim().toLowerCase();
      if (["y", "yes"].includes(answer)) { options.defaultRole = "claudia"; break; }
      if (["n", "no"].includes(answer)) { options.defaultRole = "own"; break; }
    }
  } finally {
    prompt.close();
  }
}

// --default-role takes claudia, own, or an existing custom role.
async function assertDefaultRole(projectRoot, options) {
  const value = options.defaultRole;
  if (value === undefined || value === "claudia" || value === "own") return;
  if (!/^[a-z][a-z0-9-]*$/.test(value) || builtInRoles.includes(value)) {
    throw new Error(`--default-role takes claudia, own, or the lowercase name of a custom role; "${value}" is not one.`);
  }
  for (const base of [path.join(projectRoot, harnessDirectory), projectRoot]) {
    if (await exists(path.join(base, customRolesPath, `${value}.md`))) return;
  }
  throw new Error(`--default-role ${value}: add ${harnessDirectory}/${customRolesPath}/${value}.md first.`);
}

function withoutEntryBlock(content) {
  const found = findEntryBlock(content);
  return found.state === "one" ? `${content.slice(0, found.start)}${content.slice(found.end)}` : content;
}

// Writes or refreshes the HAI-Harness block in the project's own AGENTS.md and
// never changes a byte outside it. `adopt` adds a block the file lacks (install,
// or the first update of an install that predates the block); otherwise a
// missing block was removed on purpose and stays removed. `replaceWhole` is for
// migrate, when the file is an unedited copy of the old whole-file entry.
async function refreshEntryBlock(projectRoot, options, { adopt, replaceWhole = false }) {
  const file = path.join(projectRoot, entryFile);
  const body = await readOptional(path.join(packageRoot, entryBlockSource));
  if (body === null) return { status: "noSource", installed: false };
  const raw = await readOptional(file);
  const current = raw === null ? null : raw.toString("utf8");
  const found = current === null || replaceWhole ? { state: "none" } : findEntryBlock(current);
  if (found.state === "malformed") return { status: "malformed", installed: false };
  // First install picks once: a project that already has its own AGENTS.md
  // keeps its own workflow; one without gets Claudia. Later the marker decides.
  const ownText = current !== null && !replaceWhole && withoutEntryBlock(current).trim() !== "";
  const defaultRole = options.defaultRole ?? found.defaultRole ?? (ownText ? "own" : "claudia");
  const block = renderEntryBlock(body.toString("utf8"), defaultRole);
  let next;
  let status;
  if (current === null || replaceWhole) {
    if (current === null && !adopt) return { status: "missing", installed: false };
    next = block;
    status = current === null ? "created" : "replaced";
  } else if (found.state === "none") {
    if (!adopt) return { status: "removed", installed: false };
    next = current === "" ? block : `${current}${current.endsWith("\n") ? "" : "\n"}\n${block}`;
    status = "appended";
  } else {
    next = `${current.slice(0, found.start)}${block}${current.slice(found.end)}`;
    status = next === current ? "current" : "updated";
  }
  if (!options.dryRun && next !== current) await fs.writeFile(file, next);
  return { status, installed: true, defaultRole };
}

async function entryBlockProblem(projectRoot) {
  const raw = await readOptional(path.join(projectRoot, entryFile));
  if (raw === null) return `${entryFile} is missing, so agents never see the HAI-Harness startup rules. "${upstreamCommand} init" restores the block.`;
  const found = findEntryBlock(raw.toString("utf8"));
  if (found.state === "none") return `${entryFile} has no HAI-Harness block, so agents never see the startup rules. "${upstreamCommand} init" adds it back.`;
  if (found.state === "malformed") return `${entryFile} has duplicate or unbalanced HAI-Harness markers; update leaves the file alone until exactly one ${blockStart} … ${blockEnd} pair remains.`;
  return null;
}

async function entryDefault(projectRoot) {
  const raw = await readOptional(path.join(projectRoot, entryFile));
  const found = raw === null ? { state: "none" } : findEntryBlock(raw.toString("utf8"));
  return found.state === "one" ? found.defaultRole : null;
}

async function doctor(options) {
  await assertDirectory(options.target);
  const projectRoot = path.basename(options.target) === harnessDirectory ? path.dirname(options.target) : options.target;
  const layout = await layoutOf(projectRoot);
  if (layout.kind === "legacy" || layout.kind === "partial") {
    console.log(`HAI-Harness needs attention in ${projectRoot}\n`);
    console.log(legacyLayoutMessage(projectRoot, layout.kind));
    process.exitCode = 1;
    return;
  }
  const harness = layout.harness;
  const requiredPaths = [
    ".hai-harness.json",
    installedCliPath,
    "Agents/check-for-update.mjs",
    "Agents/onboarding.md",
    "Agents/project_context.md",
    "Agents/planning.md",
    "Agents/design.md",
    ...builtInRoles.map((role) => `Agents/${role}.md`),
    "Agents/tasks/augustus.md",
    "Agents/tasks/julius.md",
    "Agents/lessons/INDEX.md",
    "Agents/lessons/README.md",
    "Agents/lessons/TEMPLATE.md",
    "Agents/skills/code-review/SKILL.md",
    "Agents/skills/implement/SKILL.md",
    "Agents/skills/debugging/SKILL.md",
    "Agents/skills/traffic-control/SKILL.md",
    "Agents/skills/lesson-logger/SKILL.md",
    "Agents/skills/human-scribe/SKILL.md",
    "Human/onboarding.md",
    "Human/brief.md",
    "Human/decisions.md"
  ];
  const missing = [];
  for (const relativePath of requiredPaths) {
    if (!(await exists(path.join(harness, relativePath)))) missing.push(shownPath(projectRoot, harness, relativePath));
  }
  const entryProblem = await entryBlockProblem(projectRoot);
  const oversized = [];
  for (const [relativePath, maxLines] of promptHygieneLimits) {
    const targetPath = path.join(harness, relativePath);
    if (!(await exists(targetPath))) continue;
    const lineCount = countLines(await fs.readFile(targetPath, "utf8"));
    if (lineCount > maxLines) oversized.push({ relativePath: shownPath(projectRoot, harness, relativePath), lineCount, maxLines });
  }
  let updateStatus = "Update status: unknown/offline";
  const checker = path.join(harness, "Agents/check-for-update.mjs");
  if (await exists(path.join(harness, ".hai-harness.json")) && await exists(checker)) {
    try {
      const { stdout } = await runFile(process.execPath, [checker, "--status", "--target", harness], {
        cwd: projectRoot,
        timeout: 6_000,
        maxBuffer: 32 * 1024
      });
      if (stdout.trim()) updateStatus = stdout.trim();
    } catch {}
  }
  const defaultRole = await entryDefault(projectRoot);
  const defaultWarnings = defaultRole && !["claudia", "own"].includes(defaultRole) && !(await exists(path.join(harness, customRolesPath, `${defaultRole}.md`)))
    ? [`The AGENTS.md block names ${defaultRole} as the default role, but ${harnessDirectory}/${customRolesPath}/${defaultRole}.md is missing. Add it or run "${upstreamCommand} update --default-role claudia".`]
    : [];
  const warnings = [
    ...defaultWarnings,
    ...await editedCoreWarnings(projectRoot, harness),
    ...await customWarnings(projectRoot, harness),
    ...await humanSyncWarnings(harness),
    ...await primaryCheckoutWarnings(projectRoot),
    ...await conflictCopyWarnings(projectRoot)
  ];
  if (missing.length === 0 && oversized.length === 0 && !entryProblem) {
    console.log(`HAI-Harness looks installed in ${projectRoot}`);
    if (defaultRole) console.log(`Messages that name no role go to ${describeDefault(defaultRole)}.`);
    if (warnings.length > 0) {
      printWarnings(warnings);
      console.log("");
    }
    console.log(updateStatus);
    return;
  }
  console.log(`HAI-Harness needs attention in ${projectRoot}`);
  if (missing.length > 0) {
    console.log("\nMissing:");
    for (const relativePath of missing) console.log(`  - ${relativePath}`);
  }
  if (entryProblem) console.log(`\n${entryProblem}`);
  if (oversized.length > 0) {
    console.log("\nOversized mandatory startup context:");
    for (const item of oversized) {
      console.log(`  - ${item.relativePath}: ${item.lineCount} lines (limit ${item.maxLines})`);
    }
    console.log("Move completed queues and historical evidence to Agents/handoffs/ or Agents/_archive/; keep live planning and task files current-only.");
  }
  printWarnings(warnings);
  console.log(`\n${updateStatus}`);
  process.exitCode = 1;
}

async function editedCoreWarnings(projectRoot, harness) {
  const receipt = await readReceipt(harness);
  const edited = [];
  for (const target of corePaths) {
    const recorded = receipt.files?.[target];
    const current = await readOptional(path.join(harness, target));
    if (recorded && current !== null && contentHash(current) !== recorded) edited.push(target);
  }
  if (edited.length === 0) return [];
  return [`Core files edited in this project, which update keeps: ${edited.map((item) => shownPath(projectRoot, harness, item)).join(", ")}. Move the change into ${harnessDirectory}/${customRolesPath}/, ${harnessDirectory}/${customSkillsPath}/ or project_context.md, then take the shipped version with "${upstreamCommand} update --accept-upstream <path>".`];
}

function frontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (field) fields[field[1].toLowerCase()] = field[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}

// Custom roles and skills are found by file name and frontmatter. Anything
// incomplete or shadowing a built-in is reported here, and agents ignore it.
async function customWarnings(projectRoot, harness) {
  const warnings = [];
  const rolesDirectory = path.join(harness, customRolesPath);
  for (const entry of await fs.readdir(rolesDirectory, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") continue;
    const shown = shownPath(projectRoot, harness, `${customRolesPath}/${entry.name}`);
    const slug = entry.name.slice(0, -3);
    const fields = frontmatter(await fs.readFile(path.join(rolesDirectory, entry.name), "utf8")) ?? {};
    if (builtInRoles.includes(slug.toLowerCase()) || builtInRoles.includes((fields.name ?? "").toLowerCase())) {
      warnings.push(`Custom role ${shown} uses a built-in role name; agents ignore it. Rename it.`);
      continue;
    }
    const problems = ["name", "description", "route-when", "writes"].filter((field) => !fields[field]).map((field) => `missing ${field}`);
    if (fields.writes && !roleWriteLevels.includes(fields.writes)) problems.push(`writes must be ${roleWriteLevels.join(", ")}`);
    if (fields.name && fields.name.toLowerCase() !== slug) problems.push(`file name must be the lowercase role name (${fields.name.toLowerCase()}.md)`);
    if (problems.length > 0) warnings.push(`Custom role ${shown} is incomplete (${problems.join("; ")}); Claudia does not route to it. See ${harnessDirectory}/${customRolesPath}/README.md.`);
  }
  const skillsDirectory = path.join(harness, customSkillsPath);
  for (const entry of await fs.readdir(skillsDirectory, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const shown = shownPath(projectRoot, harness, `${customSkillsPath}/${entry.name}`);
    if (shippedSkillNames.has(entry.name)) {
      warnings.push(`Custom skill ${shown} uses a shipped skill name; agents use the shipped skill. Rename it.`);
      continue;
    }
    const skill = await readOptional(path.join(skillsDirectory, entry.name, "SKILL.md"));
    const fields = skill === null ? {} : frontmatter(skill.toString("utf8")) ?? {};
    const problems = skill === null ? ["missing SKILL.md"] : ["name", "description"].filter((field) => !fields[field]).map((field) => `missing ${field}`);
    if (fields.name && fields.name !== entry.name) problems.push(`name must match its folder (${entry.name})`);
    if (problems.length > 0) warnings.push(`Custom skill ${shown} is incomplete (${problems.join("; ")}); agents skip it. See ${harnessDirectory}/${customSkillsPath}/README.md.`);
  }
  for (const entry of await fs.readdir(path.join(harness, "Agents/skills"), { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory() && !shippedSkillNames.has(entry.name)) warnings.push(`${shownPath(projectRoot, harness, `Agents/skills/${entry.name}`)} is not a shipped skill. Move it to ${harnessDirectory}/${customSkillsPath}/${entry.name}/ so agents find it.`);
  }
  for (const entry of await fs.readdir(path.join(harness, "Agents"), { withFileTypes: true }).catch(() => [])) {
    if (entry.isFile() && entry.name.endsWith(".md") && !corePaths.has(`Agents/${entry.name}`) && !projectStateDocs.has(entry.name)) {
      warnings.push(`${shownPath(projectRoot, harness, `Agents/${entry.name}`)} is not a harness file. If it is a custom role, move it to ${harnessDirectory}/${customRolesPath}/${entry.name.toLowerCase()} with the frontmatter in that folder's README.`);
    }
  }
  return warnings;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function generateTaskFile(role, options, results, overwrite) {
  const sourcePath = path.join(packageRoot, "Agents/tasks/TEMPLATE.md");
  const targetPath = path.join(options.target, `Agents/tasks/${role.slug}.md`);
  // Report the path where the file ends up, relative to the project root.
  const relativePath = path.relative(options.base ?? options.target, path.join(options.shownAs ?? options.target, `Agents/tasks/${role.slug}.md`)).split(path.sep).join("/");
  if (!(await exists(sourcePath))) {
    results.missingSource?.push("Agents/tasks/TEMPLATE.md");
    return;
  }
  const targetExists = await exists(targetPath);
  if (targetExists && !overwrite) {
    if (results.preserved) results.preserved.push(relativePath);
    else results.skipped.push(relativePath);
    return;
  }
  const template = await fs.readFile(sourcePath, "utf8");
  const rendered = template
    .replaceAll("{{ROLE_NAME}}", role.name)
    .replaceAll("{{ROLE_SLUG}}", role.slug);
  if (!options.dryRun) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, rendered);
  }
  const key = targetExists ? "overwritten" : "created";
  results[key].push(relativePath);
}

function printWarnings(warnings) {
  if (warnings.length === 0) return;
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`  - ${warning}`);
}

// Packets are local task metadata, not tracked harness or Human content.
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Core files compare as text with CRLF folded to LF, so a checkout with
// core.autocrlf does not make every core file look edited.
function contentHash(value) {
  return digest(Buffer.from(value).toString("utf8").replaceAll("\r\n", "\n"));
}

async function taskPacket(target) {
  const root = await gitOptional(target, ["rev-parse", "--show-toplevel"]);
  const branch = await gitOptional(target, ["branch", "--show-current"]);
  const keys = metadataKeysForBranch(branch);
  if (!root || !keys || !(await gitExitZero(root, ["check-ref-format", "--branch", branch]))) {
    throw new Error("Human sync requires a recognized task lane with task metadata; main, detached and non-task checkouts have no packet.");
  }
  const base = await gitOptional(root, ["config", "--get", `branch.${branch}.${keys.base}`]);
  const integration = await gitOptional(root, ["config", "--get", `branch.${branch}.${keys.integration}`]);
  if (!integration || !base) throw new Error(handMadeLaneMessage(branch, root));
  assertSafeBranch(integration, "Human sync task metadata has no integration branch.");
  if (integration === branch || !/^[0-9a-f]{40,64}$/.test(base) || !(await gitExitZero(root, ["merge-base", "--is-ancestor", base, "HEAD"]))) {
    throw new Error("Human sync task metadata has an invalid base or integration identity. Restore the recorded lane metadata; do not adopt another task packet.");
  }
  const common = await fs.realpath(await git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const harnessRoot = await fs.realpath(target);
  const physicalRoot = await fs.realpath(root);
  const scope = path.relative(physicalRoot, harnessRoot);
  if (scope === ".." || scope.startsWith(`..${path.sep}`) || path.isAbsolute(scope)) throw new Error("Harness target resolves outside its Git task checkout.");
  const id = digest(`${branch}\n${base}\n${scope}`);
  const directory = path.join(common, "hai-harness", "tasks", id);
  await validatePacketPaths(common, directory);
  const identity = { branch, base, integration, scope };
  return { root: harnessRoot, physicalRoot, common, directory, identity, metadata: path.join(directory, "packet.json") };
}

// Reject redirects at every namespaced component, including existing files.
// The common directory itself has already been resolved physically by Git.
async function validatePacketPaths(common, directory) {
  const relative = path.relative(common, directory);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Task packet escapes physical Git common metadata.");
  let current = common;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const stat = await fs.lstat(current).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error("Task packet namespace must contain physical directories, never symlink redirects.");
  }
  for (const name of ["packet.json", decisionTrailPath, humanInboxPath]) {
    const stat = await fs.lstat(path.join(directory, name)).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(`Task packet ${name} must be a regular file, never a symlink redirect.`);
  }
}

// Legacy migration may retire only regular files in this physical harness.
// Validate the selected harness parent chain as well as the Agents directory.
async function legacyPacketPaths(lane) {
  let current = lane.physicalRoot;
  const parents = [current];
  for (const part of [...(lane.identity.scope ? lane.identity.scope.split(path.sep) : []), "Agents"]) {
    current = path.join(current, part);
    parents.push(current);
  }
  for (const parent of parents) {
    const stat = await fs.lstat(parent).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(parent) !== parent)) {
      throw new Error("Legacy migration requires physical directories within the selected task harness; parent symlink redirects are refused.");
    }
  }
  const files = [decisionTrailPath, humanInboxPath].map((name) => path.join(lane.root, "Agents", name));
  for (const file of files) {
    const stat = await fs.lstat(file).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink() || await fs.realpath(file) !== file)) {
      throw new Error("Legacy migration requires regular files physically within the selected task harness, never redirects.");
    }
  }
  return files;
}

async function readPacket(lane) {
  if (!(await exists(lane.metadata))) throw new Error(`Missing task packet. Run "${cliCommand} human-sync init" in this recognized task lane (use --migrate for legacy Agents files).`);
  const packet = await readJson(lane.metadata);
  // Older packets have no hash for later traced paths. Keep their existing
  // digest/history intact; snapshot comparison reports the absent hash as
  // drift until an ordinary trace acknowledgment adopts it.
  const validPathHash = (name) =>
    (laterTracedPaths.has(name) && packet.acknowledged?.paths && !Object.hasOwn(packet.acknowledged.paths, name)) ||
    (typeof packet.acknowledged?.paths?.[name] === "string" && /^[0-9a-f]{64}$/.test(packet.acknowledged.paths[name]));
  if (packet.schemaVersion !== 1 || JSON.stringify(packet.identity) !== JSON.stringify(lane.identity) || !/^[0-9a-f]{40,64}$/.test(packet.acknowledged?.head ?? "") || tracedPaths.some((name) => !validPathHash(name)) || digest(JSON.stringify(packet.acknowledged?.paths)) !== packet.acknowledged?.digest || typeof packet.trail !== "string") {
    throw new Error("Invalid task packet identity or baseline; preserve it and restore this lane's verified checkpoint.");
  }
  for (const name of [decisionTrailPath, humanInboxPath]) {
    if (!(await exists(path.join(lane.directory, name)))) throw new Error(`Missing task packet ${name}; restore the verified checkpoint.`);
  }
  return packet;
}

async function tracedSnapshot(root) {
  const paths = {};
  const gitRoot = await git(root, ["rev-parse", "--show-toplevel"]);
  const scope = path.relative(gitRoot, root);
  for (const name of tracedPaths) {
    // Last touching commit catches committed changes even when their contents
    // are subsequently reverted. Index and physical content catch dirty edits.
    const gitPath = scope ? `${scope}/${name}` : name;
    const commit = await gitOptional(gitRoot, ["log", "-1", "--format=%H", "--", gitPath]);
    const index = await git(gitRoot, ["ls-files", "--stage", "--", gitPath]);
    const files = [];
    async function visit(relative) {
      const absolute = path.join(root, relative);
      const stat = await fs.lstat(absolute).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
      if (!stat) { files.push([relative, "missing"]); return; }
      if (stat.isSymbolicLink()) { files.push([relative, "symlink", await fs.readlink(absolute)]); return; }
      if (stat.isDirectory()) {
        files.push([relative, "directory"]);
        for (const child of (await fs.readdir(absolute)).sort()) await visit(`${relative}/${child}`);
      } else if (stat.isFile()) files.push([relative, stat.mode & 0o777, digest(await fs.readFile(absolute))]);
    }
    await visit(name);
    paths[name] = digest(JSON.stringify({ commit, index, files }));
  }
  return { head: await git(root, ["rev-parse", "HEAD"]), paths, digest: digest(JSON.stringify(paths)) };
}

async function savePacket(lane, packet) {
  await validatePacketPaths(lane.common, lane.directory);
  const temporary = `${lane.metadata}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await fs.rename(temporary, lane.metadata);
}

async function humanSyncCommand(args) {
  const options = parseOptions(args, new Set(["--target", "--migrate", "--through", "--head", "--snapshot", "--output"]));
  const [action = "capture"] = options.positional;
  if (options.positional.length > 1) throw new Error("human-sync accepts one lifecycle action.");
  if (!["capture", "status", "init", "acknowledge", "checkpoint"].includes(action)) throw new Error(`Unknown human-sync action: ${action}`);
  if (options.migrate && action !== "init") throw new Error("--migrate requires human-sync init.");
  if ((options.through || options.head || options.snapshot) && action !== "acknowledge") throw new Error("--through, --head and --snapshot require acknowledge.");
  if (options.output && action !== "checkpoint") throw new Error("--output requires checkpoint.");
  const lane = await taskPacket(await harnessRootFor(options.target));
  if (action === "init") {
    if (await exists(lane.directory)) throw new Error("Task packet already exists; preserve it and use status or restore its checkpoint.");
    const legacy = await legacyPacketPaths(lane);
    const present = await Promise.all(legacy.map(exists));
    if (present.some(Boolean) && !options.migrate) throw new Error("Legacy Agents storage exists. Use human-sync init --migrate to verify and retire it explicitly.");
    if (options.migrate && !present.every(Boolean)) throw new Error("Migration requires both legacy Agents files; preserve partial storage and reconcile it before migration.");
    const contents = await Promise.all([decisionTrailPath, humanInboxPath].map(async (name, index) => {
      if (!options.migrate) return packetTemplates[name];
      if (!(await fs.lstat(legacy[index])).isFile()) throw new Error("Legacy migration requires regular files, not symlinks.");
      return fs.readFile(legacy[index], "utf8");
    }));
    readCaptureCursor(contents[1]);
    const packet = { schemaVersion: 1, identity: lane.identity, createdAt: new Date().toISOString(), acknowledged: await tracedSnapshot(lane.root), trail: contents[0] };
    if (options.migrate) packet.supersession = { recordedAt: new Date().toISOString(), reason: "Task-owned packet supersedes Agents provisional storage; copied and verified before retirement.", files: legacy.map((source, index) => ({ source, sha256: digest(contents[index]), content: contents[index] })) };
    if (options.migrate) await legacyPacketPaths(lane);
    await fs.mkdir(lane.directory, { recursive: true, mode: 0o700 });
    for (const [index, name] of [decisionTrailPath, humanInboxPath].entries()) {
      const destination = path.join(lane.directory, name);
      await fs.writeFile(destination, contents[index], { mode: 0o600, flag: "wx" });
      if (await fs.readFile(destination, "utf8") !== contents[index]) throw new Error("Packet copy verification failed; legacy files retained.");
    }
    await savePacket(lane, packet); // Durable supersession receipt precedes deletion.
    if (options.migrate) {
      await legacyPacketPaths(lane);
      for (const [index, source] of legacy.entries()) {
        if (!(await fs.lstat(source)).isFile() || await fs.readFile(source, "utf8") !== contents[index]) throw new Error("Legacy storage changed during migration; packet and remaining legacy files preserved.");
      }
      for (const source of legacy) {
        await legacyPacketPaths(lane);
        await fs.unlink(source);
      }
    }
    console.log(`Task packet initialized: ${lane.directory}`);
    return;
  }
  const packet = await readPacket(lane);
  if (action === "capture") return humanSync({ ...options, target: lane.directory });
  const snapshot = await tracedSnapshot(lane.root);
  if (action === "status") {
    console.log(JSON.stringify({ packet: lane.directory, identity: lane.identity, head: snapshot.head, snapshot: snapshot.digest }, null, 2));
    return;
  }
  if (action === "checkpoint") {
    if (!options.output) throw new Error("checkpoint requires --output <file>; Git pushes do not carry task packets.");
    const requested = path.resolve(options.output);
    const output = path.join(await fs.realpath(path.dirname(requested)), path.basename(requested));
    for (const worktree of await listWorktrees(lane.root)) {
      const physical = await fs.realpath(worktree.root).catch(() => null);
      if (!physical) throw new Error("Cannot verify checkpoint destination against a missing registered worktree; preserve the packet and reconcile worktrees first.");
      const relative = path.relative(physical, output);
      if (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new Error("Keep packet checkpoints outside every tracked worktree and Agents storage in this repository.");
    }
    const files = {};
    for (const name of [decisionTrailPath, humanInboxPath]) files[name] = await fs.readFile(path.join(lane.directory, name), "utf8");
    await fs.writeFile(output, `${JSON.stringify({ packet, files, observed: snapshot }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    console.log(`Recoverable local checkpoint: ${output}. Transfer explicitly; Git does not transfer it.`);
    return;
  }
  if (!/^T[1-9]\d*$/.test(options.through ?? "") || options.head !== snapshot.head || options.snapshot !== snapshot.digest) throw new Error("Acknowledgment requires --through T<n> and the exact --head/--snapshot from human-sync status; re-observe changed state.");
  const trail = await fs.readFile(path.join(lane.directory, decisionTrailPath), "utf8");
  const appended = trail.startsWith(packet.trail) ? trail.slice(packet.trail.length) : "";
  const priorIds = parseTrailEntries(packet.trail).map((entry) => entry.id).filter(Number.isInteger);
  const entry = parseTrailEntries(`## Entries\n${appended}`).find((item) => item.id === Number(options.through.slice(1)));
  if (!entry || entry.id <= Math.max(0, ...priorIds) || !["date", "change", "why", "origin", "area"].every((field) => entry.fields[field]) || !["user", "agent"].includes(normalizeField(entry.fields.origin)) || !(captureAreas.has(normalizeField(entry.fields.area)) || normalizeField(entry.fields.area) === "code")) throw new Error("Acknowledgment requires a newly appended valid trace entry; edits to old trail entries or inbox drafts do not acknowledge drift.");
  const changed = tracedPaths.filter((name) => packet.acknowledged.paths[name] !== snapshot.paths[name]);
  if (changed.some((name) => !entry.fields.change.includes(name))) throw new Error("The new trace Change must name every changed traced path before acknowledging its snapshot.");
  const rechecked = await tracedSnapshot(lane.root);
  if (rechecked.head !== snapshot.head || rechecked.digest !== snapshot.digest || await fs.readFile(path.join(lane.directory, decisionTrailPath), "utf8") !== trail) throw new Error("Task state changed during acknowledgment; re-observe before retrying.");
  packet.acknowledged = { ...snapshot, through: options.through, recordedAt: new Date().toISOString() };
  packet.trail = trail;
  await savePacket(lane, packet);
  console.log(`Acknowledged ${options.through} at ${snapshot.head}, snapshot ${snapshot.digest}. No Human item was approved.`);
}

// Advisory only. Non-task projects retain normal installation doctor behavior.
// The primary checkout is the integration target, so uncommitted edits there block lanes.
async function primaryCheckoutWarnings(target) {
  const root = await gitOptional(target, ["rev-parse", "--show-toplevel"]);
  if (!root) return [];
  const primary = (await listWorktrees(root).catch(() => []))[0];
  if (!primary || !samePath(root, primary.root) || !primary.branch) return [];
  const dirty = await dirtyPaths(root);
  if (dirty.length === 0) return [];
  return [`The primary checkout (${primary.branch}) has uncommitted changes: ${dirty.slice(0, 5).join(", ")}${dirty.length > 5 ? ", ..." : ""}. Have the user review and commit them; worktree create and approve refuse until it is clean.`];
}

async function humanSyncWarnings(target) {
  const warnings = [];
  const branch = await gitOptional(target, ["branch", "--show-current"]);
  if (!metadataKeysForBranch(branch)) return warnings;
  try {
    const lane = await taskPacket(target);
    const packet = await readPacket(lane);
    const counts = countInboxDrafts(await fs.readFile(path.join(lane.directory, humanInboxPath), "utf8"));
    if (counts.pending + counts.deferred > 0) warnings.push(`Task packet ${humanInboxPath} has ${counts.pending} pending and ${counts.deferred} deferred draft(s) awaiting the user's closeout review.`);
    const snapshot = await tracedSnapshot(lane.root);
    const changed = tracedPaths.filter((name) => packet.acknowledged.paths[name] !== snapshot.paths[name]);
    if (changed.length) warnings.push(`Changed with no new entry: ${changed.join(", ")}. Append the why to the task trail and explicitly acknowledge the observed HEAD/snapshot.`);
  } catch (error) { warnings.push(error.message); }
  return warnings;
}

async function humanSync(options) {
  await assertDirectory(options.target);
  const trailFile = path.join(options.target, decisionTrailPath);
  const inboxFile = path.join(options.target, humanInboxPath);
  for (const [relativePath, filePath] of [[decisionTrailPath, trailFile], [humanInboxPath, inboxFile]]) {
    if (!(await exists(filePath))) throw new Error(`Missing task packet ${relativePath}; restore the verified checkpoint.`);
  }
  const cursor = readCaptureCursor(await fs.readFile(inboxFile, "utf8"));
  const entries = entriesAfterCursor(parseTrailEntries(await fs.readFile(trailFile, "utf8")), cursor);
  const after = cursor === 0 ? "since the trail began" : `after T${cursor}`;
  if (entries.length === 0) {
    console.log(`Human sync: no new trail entries ${after}.`);
    return;
  }
  const numericIds = entries.map((entry) => entry.id).filter((id) => Number.isInteger(id));
  const latest = numericIds.length > 0 ? Math.max(...numericIds) : null;
  const kept = entries.map((entry) => ({ entry, kind: captureKind(entry) })).filter((item) => item.kind);
  const advance = latest === null
    ? `number the malformed trail heading, then set "Captured through:" in ${humanInboxPath}.`
    : `set "Captured through: T${latest}" in ${humanInboxPath}.`;
  if (kept.length === 0) {
    console.log(`Human sync: nothing to capture ${after}.`);
    console.log(`${nothingToCaptureReason(entries)}; no draft is needed.`);
    console.log(`Next: ${advance}`);
    return;
  }
  console.log(`Human sync: ${kept.length} of ${entries.length} new trail entries to capture ${after}.\n`);
  for (const { entry, kind } of kept) {
    const { date = "", change = "", why = "", origin = "", area = "" } = entry.fields;
    console.log(`${entryLabel(entry)} · ${kind} · ${origin || "?"}/${area || "?"}${date ? ` · ${date}` : ""}`);
    console.log(`  Change: ${change}`);
    console.log(`  Why: ${why}`);
  }
  console.log(`\nNext: draft each entry into ${humanInboxPath}, then ${advance}`);
}

function entriesAfterCursor(entries, cursor) {
  if (cursor === 0) return entries;
  const index = entries.findIndex((entry) => entry.id === cursor);
  return entries.filter((entry, entryIndex) => {
    if (entry.malformed) return index !== -1 && entryIndex > index;
    return Number.isInteger(entry.id) && entry.id > cursor;
  });
}

function entryLabel(entry) {
  if (Number.isInteger(entry.id)) return `T${entry.id}`;
  return entry.heading.replace(/^#+\s*/, "") || "malformed heading";
}

function nothingToCaptureReason(entries) {
  const approved = entries.filter((entry) => reflectsApproved(entry)).length;
  const code = entries.length - approved;
  if (approved === 0) {
    return `${entries.length} new trail entr${entries.length === 1 ? "y was an agent-origin code change" : "ies were agent-origin code changes"}`;
  }
  if (code === 0) {
    return `${entries.length} new trail entr${entries.length === 1 ? "y reflects an already approved item" : "ies reflect already approved items"}`;
  }
  return `${code} agent-origin code entr${code === 1 ? "y" : "ies"} and ${approved} already approved entr${approved === 1 ? "y" : "ies"}`;
}

function reflectsApproved(entry) {
  return /^approved\b/.test(normalizeField(entry.fields.applies));
}

// Keep user-origin entries and agent assumptions about product, design, or
// process. Unrecognized values are kept for review rather than silently dropped.
function captureKind(entry) {
  if (entry.malformed) return "review";
  if (reflectsApproved(entry)) return null;
  const origin = normalizeField(entry.fields.origin);
  const area = normalizeField(entry.fields.area);
  if (!["user", "agent"].includes(origin) || !(captureAreas.has(area) || area === "code")) return "review";
  if (origin === "user") return "decision";
  if (captureAreas.has(area)) return 'open question ("Agents assumed ... Confirm or change?")';
  return null;
}

function normalizeField(value = "") {
  return value.replaceAll("`", "").trim().toLowerCase();
}

function parseTrailEntries(content) {
  const entries = [];
  let current;
  for (const line of sectionLines(content, "## Entries")) {
    if (line.startsWith("###")) {
      const heading = line.match(/^### T(\d+)\b/);
      current = heading
        ? { id: Number(heading[1]), malformed: false, heading: line.trim(), fields: {} }
        : { id: null, malformed: true, heading: line.trim(), fields: {} };
      entries.push(current);
      continue;
    }
    const field = current && line.match(/^- (Date|Change|Why|Origin|Area|Applies):\s*(.*)$/);
    if (field) current.fields[field[1].toLowerCase()] = field[2].trim();
  }
  return entries;
}

function readCaptureCursor(content) {
  const match = stripComments(content).match(/^Captured through:\s*(?:`?T(\d+)`?|`?none`?)\s*$/im);
  if (!match) throw new Error(`${humanInboxPath} has no "Captured through: T<n>" or "Captured through: none" line.`);
  return match[1] ? Number(match[1]) : 0;
}

function countInboxDrafts(content) {
  const counts = { pending: 0, deferred: 0 };
  for (const line of sectionLines(content, "## Drafts")) {
    const status = line.match(/^\s*- Status:\s*`?(pending|deferred)\b`?/i);
    if (status) counts[status[1].toLowerCase()] += 1;
  }
  return counts;
}

function sectionLines(content, heading) {
  const lines = stripComments(content).split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return end === -1 ? rest : rest.slice(0, end);
}

function stripComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, "");
}

function countLines(content) {
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length - (content.endsWith("\n") ? 1 : 0);
}

async function worktree(args) {
  const [action, ...rest] = args;
  if (action === "create") {
    const options = parseOptions(rest, new Set(["--target", "--integration"]));
    if (options.positional.length !== 1) throw new Error("worktree create requires one task slug.");
    await sweepConflictCopies(options.target);
    await createWorktree(options, options.positional[0]);
    return;
  }
  if (action === "status") {
    const options = parseOptions(rest, new Set(["--target", "--all"]));
    if (options.positional.length !== 0) throw new Error("worktree status accepts no positional arguments.");
    await (options.all ? worktreeStatusAll(options) : worktreeStatus(options));
    return;
  }
  if (action === "approve") {
    const options = parseOptions(rest, new Set(["--target", "--approved", "--keep-worktree"]));
    if (options.positional.length !== 0) throw new Error("worktree approve accepts no positional arguments.");
    if (!options.approved?.trim()) throw new Error("worktree approve requires --approved <message>.");
    await sweepConflictCopies(options.target);
    await approveWorktree(options);
    return;
  }
  if (action === "cleanup") {
    const options = parseOptions(rest, new Set(["--target"]));
    if (options.positional.length !== 1) throw new Error("worktree cleanup requires one task branch.");
    // The lane being removed is swept too, so leftover duplicates do not read as unfinished work.
    await sweepConflictCopies(options.target, { laneBranch: options.positional[0] });
    const result = await cleanupWorktree(options.target, options.positional[0]);
    if (!result) process.exitCode = 1;
    return;
  }
  if (action === "sweep") {
    const options = parseOptions(rest, new Set(["--target", "--quarantine"]));
    if (options.positional.length !== 0) throw new Error("worktree sweep accepts no positional arguments.");
    if (options.quarantine) await quarantineNamedCopy(options.target, options.quarantine);
    else await sweepConflictCopies(options.target, { reportClean: true });
    return;
  }
  throw new Error("worktree requires create, status, approve, cleanup, or sweep.");
}

const dirtyIntegrationMessage = "has uncommitted changes. It must stay clean: have the user review and commit them first.";

async function createWorktree(options, slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error("Task slug must use lowercase letters, numbers, and hyphens only.");
  }
  const currentRoot = await git(options.target, ["rev-parse", "--show-toplevel"]);
  const worktrees = await listWorktrees(currentRoot);
  const controlRoot = worktrees[0]?.root;
  if (!controlRoot || samePath(currentRoot, controlRoot) === false) {
    throw new Error(`Run worktree create from the primary checkout${controlRoot ? `: ${controlRoot}` : "."}`);
  }

  const integrationBranch = options.integration || await git(controlRoot, ["branch", "--show-current"]);
  assertSafeBranch(integrationBranch, "Pass --integration with a named local integration branch.");
  if (!(await localBranchExists(controlRoot, integrationBranch))) {
    throw new Error(`Unknown local integration branch: ${integrationBranch}`);
  }
  const integrationMatches = worktrees.filter((item) => item.branch === integrationBranch);
  if (integrationMatches.length !== 1) {
    throw new Error(`The integration branch must have exactly one checked-out worktree: ${integrationBranch}`);
  }
  const integrationRoot = integrationMatches[0].root;
  if ((await git(integrationRoot, ["branch", "--show-current"])) !== integrationBranch) {
    throw new Error("Integration worktree branch changed during inspection.");
  }
  await assertClean(integrationRoot, `The ${integrationBranch} checkout ${dirtyIntegrationMessage}`);

  const taskBranch = `${taskBranchPrefix}${slug}`;
  if (await localBranchExists(controlRoot, taskBranch)) throw new Error(`Task branch already exists: ${taskBranch}`);
  const taskRoot = path.join(`${controlRoot}-worktrees`, slug);
  if (await exists(taskRoot)) throw new Error(`Task worktree path already exists: ${taskRoot}`);
  const baseCommit = await git(integrationRoot, ["rev-parse", "HEAD"]);

  await fs.mkdir(path.dirname(taskRoot), { recursive: true });
  let created = false;
  try {
    await git(controlRoot, ["worktree", "add", "-b", taskBranch, taskRoot, baseCommit], { inherit: true });
    created = true;
    await git(controlRoot, ["config", "--local", `branch.${taskBranch}.${taskMetadataKeys.integration}`, integrationBranch]);
    await git(controlRoot, ["config", "--local", `branch.${taskBranch}.${taskMetadataKeys.base}`, baseCommit]);
  } catch (error) {
    if (created) {
      await git(controlRoot, ["worktree", "remove", "--force", taskRoot]).catch(() => {});
      await git(controlRoot, ["branch", "-D", taskBranch]).catch(() => {});
    }
    throw error;
  }

  console.log("Worktree ready");
  console.log(`  path:        ${taskRoot}`);
  console.log(`  branch:      ${taskBranch}`);
  console.log(`  integrates:  ${integrationBranch}`);
  console.log(`  base commit: ${baseCommit}`);
  console.log("Run the project's own preview or dev command from this task worktree; review this exact lane before approval.");
}

async function worktreeStatus(options) {
  const currentRoot = await git(options.target, ["rev-parse", "--show-toplevel"]);
  const worktrees = await listWorktrees(currentRoot);
  const controlRoot = worktrees[0]?.root;
  const branch = await git(currentRoot, ["branch", "--show-current"]);
  const dirty = (await git(currentRoot, ["status", "--porcelain", "--untracked-files=all"])).length > 0;
  console.log(`Worktree:           ${currentRoot}`);
  console.log(`Branch:             ${branch || "detached"}`);
  console.log(`Primary checkout:   ${controlRoot || "unknown"}`);
  console.log(`Working tree:       ${dirty ? "dirty" : "clean"}`);
  const metadataKeys = metadataKeysForBranch(branch);
  if (metadataKeys) {
    const integration = await gitOptional(controlRoot, ["config", "--get", `branch.${branch}.${metadataKeys.integration}`]);
    const base = await gitOptional(controlRoot, ["config", "--get", `branch.${branch}.${metadataKeys.base}`]);
    console.log(`Integration branch: ${integration || "missing"}`);
    console.log(`Base commit:        ${base || "missing"}`);
    if (!integration || !base) console.log("Lane origin:        not created by the harness (no metadata); approve and cleanup refuse it and explain the recovery");
  }
}

// Read-only lane overview built from Git alone: no registry to drift from reality.
async function worktreeStatusAll(options) {
  const currentRoot = await git(options.target, ["rev-parse", "--show-toplevel"]);
  const worktrees = await listWorktrees(currentRoot);
  const controlRoot = worktrees[0]?.root;
  const lanes = [];
  for (const item of worktrees.slice(1)) {
    const keys = metadataKeysForBranch(item.branch);
    if (!keys) continue;
    const integration = await gitOptional(controlRoot, ["config", "--get", `branch.${item.branch}.${keys.integration}`]);
    const tip = integration ? await gitOptional(controlRoot, ["rev-parse", "--verify", `refs/heads/${integration}`]) : "";
    const forkPoint = tip ? await gitOptional(controlRoot, ["merge-base", tip, item.branch]) : "";
    const committed = forkPoint ? (await git(controlRoot, ["diff", "--name-only", forkPoint, item.branch])).split("\n") : [];
    const files = [...new Set([...committed, ...await dirtyPaths(item.root)].filter(Boolean))].sort();
    const behind = forkPoint ? await git(controlRoot, ["rev-list", "--count", `${item.branch}..${tip}`]) : "unknown";
    lanes.push({ ...item, integration, behind, files });
  }
  if (lanes.length === 0) {
    console.log("No task lanes.");
    return;
  }
  for (const lane of lanes) {
    const shared = lanes
      .filter((other) => other !== lane)
      .map((other) => ({ branch: other.branch, files: lane.files.filter((file) => other.files.includes(file)) }))
      .filter((other) => other.files.length > 0);
    console.log(lane.branch);
    console.log(`  worktree:    ${lane.root}`);
    console.log(`  integrates:  ${lane.integration || "missing"} (${lane.behind} commit(s) behind)`);
    console.log(`  changed:     ${lane.files.length ? lane.files.join(", ") : "nothing yet"}`);
    for (const other of shared) console.log(`  also changed by ${other.branch}: ${other.files.join(", ")}`);
  }
}

async function dirtyPaths(root) {
  const tracked = await gitOptional(root, ["diff", "--name-only", "HEAD"]);
  const untracked = await gitOptional(root, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))].sort();
}

// Approval brings the latest integration branch into the lane first, so the lane
// is where conflicts surface and where the combined result gets tested. The
// integration branch only ever fast-forwards to a merge commit built on its
// current tip; if it moves meanwhile, Git refuses and nothing lands.
async function approveWorktree(options) {
  const taskRoot = await git(options.target, ["rev-parse", "--show-toplevel"]);
  const worktrees = await listWorktrees(taskRoot);
  const controlRoot = worktrees[0]?.root;
  if (!controlRoot || samePath(taskRoot, controlRoot)) throw new Error("Run worktree approve from a task worktree.");
  const taskBranch = await git(taskRoot, ["branch", "--show-current"]);
  const metadataKeys = metadataKeysForBranch(taskBranch);
  if (!metadataKeys) throw new Error("Approval requires a recognized task-lane branch.");

  const integrationBranch = await gitOptional(controlRoot, ["config", "--get", `branch.${taskBranch}.${metadataKeys.integration}`]);
  const baseCommit = await gitOptional(controlRoot, ["config", "--get", `branch.${taskBranch}.${metadataKeys.base}`]);
  if (!integrationBranch || !baseCommit) throw new Error(handMadeLaneMessage(taskBranch, taskRoot));
  assertSafeBranch(integrationBranch, "Task metadata has no named local integration branch.");
  if (!/^[0-9a-f]{40,64}$/.test(baseCommit)) throw new Error("Task metadata has no valid base commit.");
  if (!(await localBranchExists(controlRoot, integrationBranch))) throw new Error(`Unknown local integration branch: ${integrationBranch}`);
  const integrationMatches = worktrees.filter((item) => item.branch === integrationBranch);
  if (integrationMatches.length !== 1) throw new Error(`The integration branch must have exactly one checked-out worktree: ${integrationBranch}`);
  const integrationRoot = integrationMatches[0].root;
  if ((await git(integrationRoot, ["branch", "--show-current"])) !== integrationBranch) throw new Error("Integration worktree branch changed.");
  const dirtyIntegration = `The ${integrationBranch} checkout ${dirtyIntegrationMessage} The task worktree is preserved.`;
  await assertClean(integrationRoot, dirtyIntegration);

  await assertNoCopiesToCommit(taskRoot);
  await git(taskRoot, ["diff", "--check"], { inherit: true });
  await git(taskRoot, ["diff", "--cached", "--check"], { inherit: true });
  await git(taskRoot, ["add", "-A"]);
  await git(taskRoot, ["diff", "--cached", "--check"], { inherit: true });
  const hasStagedChanges = !(await gitExitZero(taskRoot, ["diff", "--cached", "--quiet"]));
  if (hasStagedChanges) {
    await git(taskRoot, ["commit", "-m", options.approved.trim()], { inherit: true });
  }
  await assertClean(taskRoot, "The task worktree changed during its approved commit.");
  const taskCommit = await git(taskRoot, ["rev-parse", "HEAD"]);
  if (taskCommit === baseCommit) throw new Error("There is no task change to integrate.");
  if (!(await gitExitZero(taskRoot, ["merge-base", "--is-ancestor", baseCommit, taskCommit]))) {
    throw new Error("Task branch no longer descends from its recorded base commit.");
  }
  if (!(await gitExitZero(integrationRoot, ["merge-base", "--is-ancestor", baseCommit, "HEAD"]))) {
    throw new Error("Integration branch no longer descends from the recorded task base. The task worktree is preserved.");
  }
  if (await gitExitZero(integrationRoot, ["merge-base", "--is-ancestor", taskCommit, "HEAD"])) {
    throw new Error("There is no unintegrated task commit to merge.");
  }

  const integrationTip = await git(integrationRoot, ["rev-parse", "HEAD"]);
  if (!(await gitExitZero(taskRoot, ["merge-base", "--is-ancestor", integrationTip, taskCommit]))) {
    try {
      await git(taskRoot, ["merge", "--no-ff", "-m", `Merge ${integrationBranch} into ${taskBranch}`, integrationTip], { inherit: true });
    } catch (error) {
      const conflicts = (await gitOptional(taskRoot, ["diff", "--name-only", "--diff-filter=U"])).split("\n").filter(Boolean);
      await git(taskRoot, ["merge", "--abort"]).catch(() => {});
      if (conflicts.length === 0) throw new Error(`${error.message} The lane was left unchanged.`);
      throw new Error([
        `The latest ${integrationBranch} conflicts with this lane in: ${conflicts.join(", ")}.`,
        "The lane was left unchanged and nothing was integrated.",
        "Ask the user how to resolve code conflicts. For shared notes such as Agents/ planning and Human/ logs, keep both sides.",
        `Then run "git merge ${integrationBranch}" in this worktree, resolve, commit, re-run the quick test, and approve again.`
      ].join("\n"));
    }
    console.log(`Merged the latest ${integrationBranch} into ${taskBranch}; nothing was integrated yet.`);
    console.log("Re-run the quick test in this worktree, then run approve again.");
    process.exitCode = 1;
    return;
  }

  // Build the merge commit in the lane itself, on the integration tip, then fast-forward.
  const mergeMessage = `Merge ${taskBranch}: ${options.approved.trim()}`;
  let mergeCommit = "";
  const restoreLane = `Run "git switch ${taskBranch}" in the task worktree to restore it.`;
  try {
    await switchLane(taskRoot, ["--detach", integrationTip], async () => (
      (await gitOptional(taskRoot, ["rev-parse", "HEAD"])) === integrationTip
      && !(await gitOptional(taskRoot, ["branch", "--show-current"]))
    ));
    await git(taskRoot, ["merge", "--no-ff", "--no-commit", taskCommit], { inherit: true });
    await git(taskRoot, ["commit", "-m", mergeMessage], { inherit: true });
    mergeCommit = await git(taskRoot, ["rev-parse", "HEAD"]);
    const parents = (await git(taskRoot, ["rev-list", "--parents", "-n", "1", mergeCommit])).split(" ").slice(1);
    if (parents[0] !== integrationTip || parents[1] !== taskCommit) {
      throw new Error("Local merge did not record the integration tip and the exact approved task commit.");
    }
    await assertClean(integrationRoot, dirtyIntegration);
    if ((await git(integrationRoot, ["rev-parse", "HEAD"])) !== integrationTip) {
      throw new Error(`${integrationBranch} moved during approval. Run approve again.`);
    }
    await git(integrationRoot, ["merge", "--ff-only", mergeCommit], { inherit: true });
  } catch (error) {
    await git(taskRoot, ["merge", "--abort"]).catch(() => {});
    const restored = await switchLane(taskRoot, [taskBranch], laneOnBranch(taskRoot, taskBranch)).then(() => true, () => false);
    throw new Error(`${error.message} The task branch was preserved.${restored ? "" : ` ${restoreLane}`}`);
  }

  const restored = await switchLane(taskRoot, [taskBranch], laneOnBranch(taskRoot, taskBranch)).then(() => true, () => false);
  console.log("Approved result merged locally.");
  console.log(`  integration branch: ${integrationBranch}`);
  console.log(`  task commit:        ${taskCommit}`);
  console.log(`  merge commit:       ${mergeCommit}`);
  if (!restored) {
    console.log(`Cleanup retained: lane could not return to ${taskBranch}. ${restoreLane}`);
  } else if (options.keepWorktree) {
    console.log(`Task worktree retained by --keep-worktree: ${taskRoot}`);
    console.log(`After verified task completion: ${cliCommand} worktree cleanup ${taskBranch} --target ${controlRoot}`);
  } else {
    await cleanupWorktree(controlRoot, taskBranch);
  }
  console.log("No push, pull request, remote merge, deployment, or publication was performed.");
}

// No process ownership is inferred here. The agent stops its own preview sessions
// before calling cleanup, and retains the lane while outward work remains pending.
async function cleanupWorktree(target, branch) {
  const keys = metadataKeysForBranch(branch);
  if (!keys || !(await gitExitZero(target, ["check-ref-format", "--branch", branch]))) throw new Error("Cleanup requires a recognized task-lane branch.");
  const root = await git(target, ["rev-parse", "--show-toplevel"]);
  let worktrees = await listWorktrees(root);
  const controlRoot = await fs.realpath(worktrees[0].root);
  const slug = branch.slice(branch.indexOf("/") + 1);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error("Cleanup cannot establish the canonical task lane path; preserve and inspect it manually.");
  const laneRoot = path.join(`${controlRoot}-worktrees`, slug);
  const retained = (reason) => {
    console.log(`Cleanup retained ${branch}: ${reason}`);
    console.log(`  task path: ${laneRoot}`);
    console.log(`  retry: ${cliCommand} worktree cleanup ${branch} --target ${controlRoot}`);
    return false;
  };
  if (!(await localBranchExists(root, branch))) {
    if (await exists(laneRoot)) return retained("Task branch is absent but a folder remains; ownership cannot be verified. No files were removed.");
    if (worktrees.some((item) => samePath(item.root, laneRoot))) return retained("Task branch is absent but a worktree registration remains.");
    console.log(`Cleanup already complete: ${branch}; task branch and folder are absent.`);
    return true;
  }
  const integration = await gitOptional(root, ["config", "--get", `branch.${branch}.${keys.integration}`]);
  const base = await gitOptional(root, ["config", "--get", `branch.${branch}.${keys.base}`]);
  if (!integration || !base) {
    console.log(`Cleanup retained ${branch}: ${handMadeLaneMessage(branch, laneRoot)}`);
    console.log(`  task path: ${laneRoot}`);
    return false;
  }
  try {
    assertSafeBranch(integration, "Task metadata has no integration branch.");
    if (integration === branch || !/^[0-9a-f]{40,64}$/.test(base)) throw new Error("Task metadata has an invalid base or integration identity.");
    const tip = await git(root, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    if (!(await gitExitZero(root, ["merge-base", "--is-ancestor", base, tip]))) throw new Error("Task tip no longer descends from its recorded base.");
    if (!(await gitExitZero(root, ["merge-base", "--is-ancestor", tip, `refs/heads/${integration}`]))) throw new Error(`Exact task tip ${tip} is not integrated into ${integration}; a push alone is not completion.`);
    const integrationWorktrees = worktrees.filter((item) => item.branch === integration);
    if (integrationWorktrees.length !== 1) throw new Error(`Integration branch ${integration} must have exactly one checked-out worktree for safe branch deletion.`);
    const integrationRoot = integrationWorktrees[0].root;
    const matches = worktrees.filter((item) => item.branch === branch || samePath(item.root, laneRoot));
    if (matches.length > 1 || (matches[0] && (matches[0].branch !== branch || !samePath(matches[0].root, laneRoot)))) throw new Error("Task path or branch is owned by another worktree; preserve it.");
    if (matches[0]?.locked) throw new Error(`Worktree is locked: ${matches[0].locked}`);
    const common = await fs.realpath(await git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
    // Check all registered scopes of this task, not peer packets. Never delete packets.
    const tasks = path.join(common, "hai-harness", "tasks");
    await validatePacketPaths(common, tasks);
    for (const entry of await fs.readdir(tasks).catch((error) => { if (error.code === "ENOENT") return []; throw error; })) {
      const directory = path.join(tasks, entry);
      const metadata = path.join(directory, "packet.json");
      // Discover identity through physical metadata only. Do not inspect peer
      // inboxes or trails; their closeout belongs to their own controller.
      const dirStat = await fs.lstat(directory);
      const metaStat = await fs.lstat(metadata).catch(() => null);
      if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || !metaStat?.isFile() || metaStat.isSymbolicLink()) throw new Error(`Cannot safely identify task packet namespace: ${directory}`);
      const packet = await readJson(metadata);
      if (packet.identity?.branch !== branch) continue;
      if (!/^[0-9a-f]{40,64}$/.test(packet.identity.base ?? "")) throw new Error(`Invalid task packet base: ${directory}`);
      // A completed slug may be reused. Older branch/base incarnations stay
      // recoverable, but do not govern this lane's closeout.
      if (packet.identity.base !== base) continue;
      await validatePacketPaths(common, directory);
      console.log(`Task packet retained: ${directory}`);
      if (packet.schemaVersion !== 1 || packet.identity.base !== base || packet.identity.integration !== integration || typeof packet.identity.scope !== "string" || entry !== digest(`${branch}\n${base}\n${packet.identity.scope}`)) throw new Error(`Invalid task packet identity: ${directory}`);
      const inbox = await fs.readFile(path.join(directory, humanInboxPath), "utf8");
      const trail = await fs.readFile(path.join(directory, decisionTrailPath), "utf8");
      for (const [content, heading] of [[inbox, "## Drafts"], [trail, "## Entries"]]) {
        const headings = stripComments(content).split(/\r?\n/).filter((line) => line.trim() === heading);
        if (headings.length !== 1) throw new Error(`Task packet requires exactly one ${heading} section; found ${headings.length}: ${directory}`);
      }
      const counts = countInboxDrafts(inbox);
      if (counts.pending + counts.deferred) throw new Error(`Task packet has ${counts.pending} pending and ${counts.deferred} deferred draft(s): ${directory}`);
      if (sectionLines(inbox, "## Drafts").some((line) => line.startsWith("###"))) throw new Error(`Task packet has unresolved draft entries: ${directory}`);
      const cursor = readCaptureCursor(inbox);
      const uncaptured = entriesAfterCursor(parseTrailEntries(trail), cursor).filter((entry) => captureKind(entry));
      if (uncaptured.length) throw new Error(`Task packet has uncaptured review items: ${directory}`);
    }
    if (!matches.length && await exists(laneRoot)) throw new Error("Git has unregistered the task folder. Preserve remaining contents for inspection; no arbitrary folder deletion is performed.");
    if (matches.length) {
      if (await fs.realpath(laneRoot) !== laneRoot || (await fs.lstat(laneRoot)).isSymbolicLink()) throw new Error("Task lane resolves through a symlink redirect.");
      await assertClean(laneRoot, "Task lane has staged, tracked, or untracked work.");
      const ignored = await git(laneRoot, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"]);
      if (ignored) throw new Error(`Ignored files may contain valuable work; preserve them for inspection:\n${ignored}`);
      if ((await git(laneRoot, ["rev-parse", "HEAD"])) !== tip) throw new Error("Task checkout tip changed during inspection.");
      // Native Git removal keeps its final dirty/submodule protection enabled.
      await git(controlRoot, ["worktree", "remove", laneRoot]);
    }
    worktrees = await listWorktrees(controlRoot);
    if (worktrees.some((item) => samePath(item.root, laneRoot))) throw new Error("Task worktree registration remains.");
    console.log(`Temporary task worktree removed from Git registration (or already absent): ${laneRoot}`);
    if (await exists(laneRoot)) throw new Error("Git unregistered the worktree but its folder remains. Branch retained; inspect the exact folder before retrying.");
    if ((await git(controlRoot, ["rev-parse", `refs/heads/${branch}`])) !== tip) throw new Error("Task branch moved during cleanup; its newer work is retained.");
    if (!(await gitExitZero(controlRoot, ["merge-base", "--is-ancestor", tip, `refs/heads/${integration}`]))) throw new Error("Integration target changed during cleanup; task branch retained.");
    // -d keeps Git's final merged/checkout safety check; never force deletion.
    if ((await git(integrationRoot, ["branch", "--show-current"])) !== integration) throw new Error("Integration checkout changed; task branch retained.");
    await git(integrationRoot, ["branch", "-d", branch]);
    console.log(`Merged local task branch removed: ${branch}`);
    return true;
  } catch (error) {
    return retained(error.message);
  }
}

// A failing post-checkout hook makes `git switch` exit non-zero after it already switched.
async function switchLane(root, target, landed) {
  try {
    await git(root, ["switch", ...target]);
  } catch (error) {
    if (!(await landed())) throw error;
  }
}

function laneOnBranch(root, branch) {
  return async () => (await gitOptional(root, ["branch", "--show-current"])) === branch;
}

function metadataKeysForBranch(branch) {
  if (branch.startsWith(taskBranchPrefix)) return taskMetadataKeys;
  // Compatibility for task lanes created before the provider-neutral convention.
  if (branch.startsWith(legacyTaskBranchPrefix)) return legacyTaskMetadataKeys;
  return null;
}

// A lane made with plain `git worktree add` carries no harness metadata, and the
// harness never accepts hand-written metadata: recovery goes through a real lane.
function handMadeLaneMessage(branch, laneRoot) {
  return [
    `${branch} was not created by the harness: it has no recorded integration branch or base commit, so the harness cannot tell what it would merge into.`,
    "Do not hand-write lane metadata to make it pass, and leave this lane and branch in place until the user decides.",
    `Recovery: commit any pending work in ${laneRoot} (or have the user review it), then from the clean primary checkout run "${cliCommand} worktree create <new-slug>", run "git merge ${branch}" inside that new lane, and approve from the new lane.`,
    `After that integrates, ask the user before removing the old lane by hand with "git worktree remove <path>" and "git branch -d ${branch}"; the harness only cleans up lanes it created.`
  ].join("\n");
}

function assertSafeBranch(branch, missingMessage) {
  if (!branch) throw new Error(missingMessage);
  if (branch.startsWith("-") || branch.includes("..") || /[\s~^:?*[\\]/.test(branch)) {
    throw new Error(`Unsafe integration branch name: ${branch}`);
  }
}

async function assertClean(root, message) {
  const status = await git(root, ["status", "--porcelain", "--untracked-files=all"]);
  if (status) throw new Error(`${message}\n${status}`);
}

async function listWorktrees(root) {
  const output = await git(root, ["worktree", "list", "--porcelain"]);
  const result = [];
  let current;
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { root: path.resolve(line.slice(9)), branch: "" };
      result.push(current);
    } else if (current && line.startsWith("locked")) {
      current.locked = line.slice(6).trim() || "locked";
    } else if (current && line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }
  return result;
}

async function localBranchExists(root, branch) {
  return gitExitZero(root, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
}

async function git(root, args, options = {}) {
  try {
    const result = await runFile("git", ["-C", root, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: options.inherit ? "inherit" : undefined
    });
    return options.inherit ? "" : result.stdout.trim();
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
}

async function gitOptional(root, args) {
  try {
    return await git(root, args);
  } catch {
    return "";
  }
}

async function gitExitZero(root, args) {
  try {
    await runFile("git", ["-C", root, ...args]);
    return true;
  } catch {
    return false;
  }
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function conflictOriginalName(name) {
  const match = name.match(conflictCopyName);
  return match ? `${match[1]}${match[2] ?? ""}` : null;
}

const lexists = (file) => fs.lstat(file).then(() => true, () => false);

async function conflictScope(target, { laneBranch } = {}) {
  const top = await gitOptional(target, ["rev-parse", "--show-toplevel"]);
  if (!top) return null;
  const common = await gitOptional(top, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const worktrees = await listWorktrees(top).catch(() => []);
  if (!common || worktrees.length === 0) return null;
  const lane = laneBranch ? worktrees.find((item) => item.branch === laneBranch) : undefined;
  const physical = await Promise.all([worktrees[0].root, top, lane?.root].filter(Boolean).map((root) => fs.realpath(root).catch(() => null)));
  return {
    common: await fs.realpath(common),
    control: physical[0] ?? worktrees[0].root,
    roots: [...new Set(physical.filter(Boolean))]
  };
}

// Everything in the Git common directory: loose refs, HEAD, index caches, the
// registered worktree admin dirs and the harness task packets. A conflict-named
// directory is judged as one unit and not entered.
async function findGitConflictCopies(common) {
  const found = [];
  const visit = async (directory, relative) => {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const isCopy = conflictOriginalName(entry.name) !== null;
      if (entry.isDirectory()) {
        if (/(?:^|\/)objects\/[0-9a-f]{2}$/.test(rel) || rel === "hai-harness/quarantine") continue;
        if (isCopy) found.push(rel);
        else await visit(path.join(directory, entry.name), rel);
      } else if (isCopy) {
        found.push(rel);
      }
    }
  };
  await visit(common, "");
  return found;
}

// Untracked files only: a tracked file is never a quarantine candidate.
async function findTreeConflictCopies(root) {
  const listed = await gitOptional(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  return listed.split("\0").filter((rel) => rel && conflictOriginalName(path.basename(rel)) !== null);
}

async function planConflictSweep(scope) {
  const plan = [];
  // A concurrent sweep may take a copy while it is being judged; a copy that is
  // gone by then is handled, not "kept" and certainly not blocking.
  const consider = async (item) => {
    if (item && (item.action !== "keep" || await lexists(item.copy))) plan.push(item);
  };
  for (const rel of await findGitConflictCopies(scope.common)) await consider(await decideGitCopy(scope, rel));
  for (const root of scope.roots) {
    for (const rel of await findTreeConflictCopies(root)) await consider(await decideTreeCopy(root, rel));
  }
  return plan;
}

function conflictItem(area, root, rel, copy) {
  const original = path.join(path.dirname(copy), conflictOriginalName(path.basename(copy)));
  return { area, root, rel, copy, original, action: "keep", reason: "", why: "", next: "", blocking: false };
}

function markRedundant(item, reason) {
  return Object.assign(item, { action: "quarantine", reason });
}

// A kept copy that Git or the harness itself reads stops the lane commands.
function readerOf(item) {
  if (item.area !== "git") return "";
  if (gitRefCopy.test(item.rel)) return "Git reads it as a ref (typically as \"bad object\").";
  if (gitHeadCopy.test(item.rel)) return "Git may read it as HEAD.";
  if (gitWorktreeCopy.test(item.rel)) return item.directory ? "Git lists a copy of a worktree admin directory as an extra worktree." : "A stray copy-named entry sits in Git's worktree admin area and blocks lane commands until it is resolved.";
  if (packetDirectoryCopy.test(item.rel)) return item.directory ? "Task-packet commands read every directory under hai-harness/tasks, so a copy fails them with \"Invalid task packet identity\"." : "A stray copy-named entry sits among the task packets in hai-harness/tasks and blocks lane commands until it is resolved.";
  return "";
}

function markKept(item, why, next) {
  const reader = readerOf(item);
  return Object.assign(item, { action: "keep", why: reader ? `${why} ${reader}` : why, next, blocking: Boolean(reader) });
}

async function decideGitCopy(scope, rel) {
  const item = conflictItem("git", scope.common, rel, path.join(scope.common, ...rel.split("/")));
  const stat = await fs.lstat(item.copy).catch(() => null);
  if (!stat) return null;
  item.directory = stat.isDirectory();
  if (stat.isSymbolicLink()) return markKept(item, "It is a symbolic link.", compareNext);
  const original = await fs.lstat(item.original).catch(() => null);
  if (stat.isFile() && gitIndexCopy.test(rel)) {
    if (!original?.isFile()) return markKept(item, "The original index is missing, so this copy may hold the only staged state.", missingNext);
    return markRedundant(item, "Git index copy; it may hold staged state, so it is stored in the quarantine and can be restored from the manifest");
  }
  if (stat.isFile() && original?.isFile() && await sameContent(item.copy, item.original)) {
    return markRedundant(item, "byte-identical to the original");
  }
  if (stat.isFile() && rel.startsWith("refs/")) return decideRefCopy(scope, item);
  if (!original) return markKept(item, "The original does not exist.", missingNext);
  if (stat.isDirectory() && original.isDirectory() && await sameTree(item.copy, item.original)) {
    return markRedundant(item, "identical to the original directory");
  }
  return markKept(item, stat.isDirectory() === original.isDirectory() ? "Its content differs from the original." : "It is not the same kind of entry as the original.", compareNext);
}

// A loose ref copy is redundant when its commit is already reachable from the
// real ref; anything else could hold work the real ref lacks.
async function decideRefCopy(scope, item) {
  const refName = path.relative(scope.common, item.original).split(path.sep).join("/");
  const target = await gitOptional(scope.control, ["rev-parse", "--verify", "--quiet", `${refName}^{commit}`]);
  const copyId = (await fs.readFile(item.copy, "utf8").catch(() => "")).trim();
  if (!target) return markKept(item, `The original ref ${refName} does not exist.`, "If the branch should exist, inspect the commit named inside the copy with `git log -3 <id>` and ask the user before recreating it; then ask the user to move the copy out of the Git directory.");
  if (!/^[0-9a-f]{40,64}$/.test(copyId)) return markKept(item, "It is not a plain commit id, so it cannot be compared.", compareNext);
  if (!(await gitExitZero(scope.control, ["cat-file", "-e", `${copyId}^{commit}`]))) {
    return markKept(item, `The commit ${copyId} it names does not exist in this repository.`, "Ask the user to move the copy out of the Git directory; the real ref is unaffected.");
  }
  if (await gitExitZero(scope.control, ["merge-base", "--is-ancestor", copyId, target])) {
    return markRedundant(item, `its commit is already part of ${refName}`);
  }
  return markKept(item, `Its commit ${copyId} is not part of ${refName}, so it may hold newer work.`, `Inspect it with \`git log -3 ${copyId}\`; to keep that work run \`git branch <new-name> ${copyId}\`, then ask the user to move the copy out of the Git directory.`);
}

async function decideTreeCopy(root, rel) {
  const item = conflictItem("tree", root, rel, path.join(root, ...rel.split("/")));
  const stat = await fs.lstat(item.copy).catch(() => null);
  if (!stat) return null;
  if (!stat.isFile()) return markKept(item, "It is not a regular file.", compareNext);
  const original = await fs.lstat(item.original).catch(() => null);
  if (!original) return markKept(item, "The original does not exist.", missingNext);
  if (!original.isFile()) return markKept(item, "The original is not a regular file.", compareNext);
  if (await sameContent(item.copy, item.original)) return markRedundant(item, "byte-identical to the original");
  return markKept(item, "Its content differs from the original.", compareNext);
}

async function fileDigest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function sameContent(left, right) {
  const [a, b] = await Promise.all([fs.lstat(left), fs.lstat(right)]).catch(() => []);
  if (!a?.isFile() || !b?.isFile() || a.size !== b.size) return false;
  return (await fileDigest(left)) === (await fileDigest(right));
}

async function treeFingerprint(directory, relative = "", found = new Map()) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await treeFingerprint(full, rel, found);
    else if (entry.isFile()) found.set(rel, await fileDigest(full));
    else found.set(rel, entry.isSymbolicLink() ? `link:${await fs.readlink(full)}` : "other");
  }
  return found;
}

async function sameTree(left, right) {
  const [a, b] = await Promise.all([treeFingerprint(left), treeFingerprint(right)]).catch(() => []);
  return Boolean(a && b) && a.size === b.size && [...a].every(([rel, digestValue]) => b.get(rel) === digestValue);
}

// Plans without moving: doctor reports exactly what the sweep would do.
async function conflictCopyWarnings(target) {
  const scope = await conflictScope(target).catch(() => null);
  if (!scope) return [];
  const plan = await planConflictSweep(scope).catch(() => []);
  const warnings = [];
  const movable = plan.filter((item) => item.action === "quarantine");
  if (movable.length > 0) {
    warnings.push(`${movable.length} redundant cloud-sync conflict cop${movable.length === 1 ? "y" : "ies"} ("<name> <N>"): ${movable.map((item) => item.copy).join(", ")}. Run "${cliCommand} worktree sweep" to move them to a reversible quarantine; do not delete them by hand.`);
  }
  for (const item of plan.filter((entry) => entry.action === "keep")) {
    warnings.push(`Conflict copy needs a decision${item.blocking ? " (worktree commands stop until it is settled)" : ""}: ${item.copy} (original: ${item.original}). ${item.why} ${item.next}`);
  }
  return warnings;
}

function stop(headline, lines, footer) {
  return new Error([`Stopped: ${headline}`, ...lines, footer].join("\n"));
}

async function sweepConflictCopies(target, { laneBranch, reportClean = false } = {}) {
  const scope = await conflictScope(target, { laneBranch });
  if (!scope) {
    if (reportClean) throw new Error("worktree sweep needs a Git checkout.");
    return;
  }
  const plan = await planConflictSweep(scope);
  const session = { directory: "" };
  const moved = [];
  for (const item of plan.filter((entry) => entry.action === "quarantine")) {
    try {
      if (await moveToQuarantine(scope, session, item) === "moved") moved.push(item);
      else item.action = "gone"; // another sweep already took it
    } catch (error) {
      markKept(item, `It could not be moved to the quarantine (${error.message}).`, compareNext);
    }
  }
  const unresolved = plan.filter((item) => item.action === "keep");
  if (moved.length > 0) {
    console.log(`Conflict copies: moved ${moved.length} redundant cloud-sync duplicate${moved.length === 1 ? "" : "s"} to a reversible quarantine; nothing was deleted.`);
    console.log(`  quarantine: ${session.directory} (manifest.txt records where each came from)`);
    for (const item of moved) console.log(`  - ${item.copy}: ${item.reason}`);
  }
  const describe = (item) => `  - ${item.copy}\n    original: ${item.original}\n    why:      ${item.why}\n    next:     ${item.next}`;
  const open = unresolved.filter((item) => !item.blocking);
  if (open.length > 0) {
    console.log(`Conflict copies kept (${open.length}); they need a decision and were not changed:`);
    for (const item of open) console.log(describe(item));
  }
  const blocking = unresolved.filter((item) => item.blocking);
  if (blocking.length > 0) {
    const changed = moved.length > 0 ? `${moved.length} redundant cop${moved.length === 1 ? "y was" : "ies were"} moved to the quarantine as listed above; nothing else was changed.` : "Nothing was changed.";
    throw stop(
      `a cloud-sync conflict copy in Git metadata is not provably redundant, and Git or the harness may read it. ${changed}`,
      blocking.map(describe),
      `Settle it with the user, then re-run the command. Never delete it by hand. "${cliCommand} worktree sweep" moves what is provably redundant; ${quarantineAdvice}.`
    );
  }
  if (reportClean && moved.length === 0 && unresolved.length === 0) console.log("No conflict copies found.");
}

// approve stages everything with `git add -A`, so it refuses to commit an
// untracked file or directory named like a sync duplicate of one that exists.
async function assertNoCopiesToCommit(lane) {
  const listed = await gitOptional(lane, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const copies = new Map();
  for (const entry of listed.split("\0").filter(Boolean)) {
    const parts = entry.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const originalName = conflictOriginalName(parts[index]);
      const original = originalName === null ? "" : path.join(lane, ...parts.slice(0, index), originalName);
      if (original && await lexists(original)) {
        copies.set(path.join(lane, ...parts.slice(0, index + 1)), original);
        break; // the topmost copy-named component covers everything beneath it
      }
    }
  }
  if (copies.size === 0) return;
  throw stop(
    "approve would commit what looks like a cloud-sync conflict copy. Nothing was committed.",
    [...copies].map(([copy, original]) => `  - ${copy}\n    original: ${original}`),
    `Each path is named like a sync duplicate of one that exists. Ask the user to merge what is needed into the original and rename or remove the copy. If a listed path is intentional, rename it or stage it with \`git add <path>\`. For a file, ${quarantineAdvice}. Then run approve again.`
  );
}

// Moves one copy the user has approved by path, whether or not the sweep would
// have kept it. Tracked files and anything not named like a copy are refused.
async function quarantineNamedCopy(target, requested) {
  const scope = await conflictScope(target);
  if (!scope) throw new Error("worktree sweep needs a Git checkout.");
  const absolute = path.resolve(target, requested);
  const parent = await fs.realpath(path.dirname(absolute)).catch(() => null);
  const copy = parent ? path.join(parent, path.basename(absolute)) : absolute;
  const stat = await fs.lstat(copy).catch(() => null);
  if (!stat) throw new Error(`No such file or directory: ${requested}`);
  if (conflictOriginalName(path.basename(copy)) === null) throw new Error(`${copy} is not named like a cloud-sync conflict copy ("<name> <N>"); only such copies can be quarantined.`);
  const within = (base) => {
    const rel = path.relative(base, copy);
    return rel && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel) ? rel.split(path.sep).join("/") : null;
  };
  let item;
  const gitRel = within(scope.common);
  if (gitRel !== null) {
    if (/^hai-harness\/quarantine(?:\/|$)/.test(gitRel)) throw new Error("That path is already inside the quarantine.");
    item = await decideGitCopy(scope, gitRel);
  } else {
    const root = scope.roots.find((candidate) => within(candidate) !== null);
    if (!root) throw new Error(`${copy} is outside this repository's Git directory and its primary and current checkouts.`);
    const rel = within(root);
    if (!stat.isFile()) throw new Error("Only a regular file can be quarantined from a checkout; a directory copy is merged, renamed or removed by the user.");
    // A file inside a nested repository or submodule is that repository's, not this checkout's.
    const owner = await gitOptional(path.dirname(copy), ["rev-parse", "--show-toplevel"]);
    if (!owner || (await fs.realpath(owner).catch(() => owner)) !== root) {
      throw new Error(`${copy} belongs to a different Git repository (a nested repository or submodule${owner ? ` at ${owner}` : ""}); only untracked files of this checkout can be quarantined.`);
    }
    if (await gitExitZero(root, ["ls-files", "--error-unmatch", "--", `:(literal)${rel}`])) throw new Error(`${copy} is tracked; tracked files are never quarantined.`);
    item = await decideTreeCopy(root, rel);
  }
  if (!item) throw new Error(`${copy} disappeared before it could be moved.`);
  item.reason = `user-directed with worktree sweep --quarantine; the sweep ${item.action === "keep" ? `had kept it: ${item.why}` : `also judged it redundant: ${item.reason}`}`;
  const session = { directory: "" };
  if (await moveToQuarantine(scope, session, item) !== "moved") throw new Error(`${copy} disappeared before it could be moved.`);
  console.log(`Conflict copy moved to the reversible quarantine at the user's direction; nothing was deleted: ${item.copy}`);
  console.log(`  quarantine: ${session.directory} (manifest.txt marks it user-directed; move it back to restore it)`);
}

// Returns "moved", or "gone" when the copy was already taken by a concurrent sweep.
// A failed move (for example across volumes) throws and the copy stays where it is.
async function moveToQuarantine(scope, session, item) {
  if (!session.directory) {
    // The process id keeps two sweeps in the same millisecond out of one folder.
    const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
    const directory = path.join(scope.common, "hai-harness", "quarantine", stamp);
    await fs.mkdir(directory, { recursive: true });
    await validatePacketPaths(scope.common, directory);
    await fs.writeFile(path.join(directory, "manifest.txt"), `HAI-Harness conflict-copy quarantine, ${new Date().toISOString()}\nNothing here was deleted. To restore a file, move it back to its "from" path.\n`, { flag: "wx" });
    session.directory = directory;
  }
  const area = item.area === "git" ? "git" : path.join("tree", path.basename(item.root));
  const base = path.join(session.directory, area, ...item.rel.split("/"));
  let destination = base;
  for (let suffix = 1; await lexists(destination); suffix += 1) destination = `${base}.${suffix}`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.rename(item.copy, destination);
  } catch (error) {
    if (error.code === "ENOENT" && !(await lexists(item.copy))) return "gone";
    throw error;
  }
  // The file is already safe in the quarantine at its original relative path, so
  // a manifest write failure must not report the move as failed.
  await fs.appendFile(path.join(session.directory, "manifest.txt"), `\n- from: ${item.copy}\n  original: ${item.original}\n  reason: ${item.reason}\n  stored: ${destination}\n`).catch(() => {});
  return "moved";
}

async function copyFile(sourcePath, targetPath, options, results) {
  if (!(await exists(sourcePath))) return;
  const relativePath = path.relative(options.base ?? options.target, targetPath).split(path.sep).join("/");
  const targetExists = await exists(targetPath);
  if (targetExists && !options.force) {
    results.skipped.push(relativePath);
    return;
  }
  if (!options.dryRun) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
  results[targetExists ? "overwritten" : "created"].push(relativePath);
}

async function copyDirectory(sourceDir, targetDir, options, results) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  if (!options.dryRun) await fs.mkdir(targetDir, { recursive: true });
  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath, options, results);
    else if (entry.isFile()) await copyFile(sourcePath, targetPath, options, results);
  }
}

async function assertDirectory(target) {
  let stats;
  try {
    stats = await fs.stat(target);
  } catch {
    throw new Error(`Target directory does not exist: ${target}`);
  }
  if (!stats.isDirectory()) throw new Error(`Target is not a directory: ${target}`);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function printInitSummary(target, options, results) {
  console.log(`${options.dryRun ? "Dry run complete" : "HAI-Harness installed"} for ${target}\n`);
  printCount("Created", results.created);
  printCount("Overwritten", results.overwritten);
  printCount("Skipped existing", results.skipped);
  console.log(`\n${entrySummary(results.entry)}`);
  if (results.skipped.length > 0 && !options.force) {
    console.log("\nExisting files were left unchanged. Re-run with --force to overwrite harness files.");
  }
}

function printUpdateSummary(target, options, results) {
  console.log(`${options.dryRun ? "Dry run complete" : "HAI-Harness updated"} for ${target}\n`);
  printRefreshDetails(results);
  console.log("\nProject-authored planning, context, design, task queues, handoffs, lessons, archives, custom roles and skills, and Human content were left untouched.");
  console.log(`Run \`${upstreamCommand} init --force\` only when you intentionally want to overwrite everything.`);
}

function printRefreshDetails(results) {
  printCount("Updated", results.updated);
  printCount("Created", results.created);
  if (results.accepted.length > 0) printCount("Replaced with the shipped version (--accept-upstream)", results.accepted);
  console.log(`Already current: ${results.current.length}`);
  printCount("Preserved project state", results.preserved);
  if (results.retired.length > 0) printCount("Retired (no longer shipped, unedited)", results.retired);
  if (results.retiredKept.length > 0) printCount("No longer shipped but edited here (kept; review and remove when done)", results.retiredKept);
  if (results.missingSource.length > 0) printCount("Missing in package (skipped)", results.missingSource);
  console.log(`\n${entrySummary(results.entry)}`);
  if (results.kept.length > 0) {
    console.log("");
    printCount("Locally modified, kept (this project edited them)", results.kept);
    console.log(`Move each customization into ${harnessDirectory}/${customRolesPath}/, ${harnessDirectory}/${customSkillsPath}/ or project_context.md,`);
    console.log(`then take the shipped version: ${upstreamCommand} update --accept-upstream <path>`);
  }
}

function entrySummary(entry) {
  const text = {
    created: `${entryFile}: created with the HAI-Harness block.`,
    appended: `${entryFile}: HAI-Harness block added at the end; the rest of the file is unchanged.`,
    updated: `${entryFile}: HAI-Harness block refreshed; everything outside the markers is unchanged.`,
    current: `${entryFile}: HAI-Harness block already current.`,
    replaced: `${entryFile}: it was an unedited copy of the old harness entry file, so it now holds just the HAI-Harness block.`,
    removed: `${entryFile} has no HAI-Harness block, so it was left alone and agents will not see the startup rules. If that was not on purpose, "${upstreamCommand} init" adds it back.`,
    missing: `${entryFile} is missing, so agents will not see the startup rules. "${upstreamCommand} init" restores it.`,
    malformed: `${entryFile} has duplicate or unbalanced HAI-Harness markers and was left unchanged. Keep exactly one ${blockStart} … ${blockEnd} pair, then run update.`,
    noSource: `${entryFile} was left unchanged: this package has no ${entryBlockSource}.`
  }[entry?.status] ?? "";
  return entry?.defaultRole ? `${text}\nMessages that name no role go to ${describeDefault(entry.defaultRole)}. To change this once: ${upstreamCommand} update --default-role claudia|own|<custom role>` : text;
}

function printMigrateSummary(root, options, moves, results, report) {
  console.log(options.dryRun
    ? `Migration dry run for ${root}: nothing was changed. Paths are shown where they will be after the move.\n`
    : `HAI-Harness moved into ${harnessDirectory}/ in ${root}\n`);
  printCount("Moved", moves.map((name) => `${name} -> ${harnessDirectory}/${name}`));
  printRefreshDetails(results);
  if (report.roles.length > 0) {
    console.log("");
    printCount(`Not harness files; if a file is a custom role, move it to ${harnessDirectory}/${customRolesPath}/ with the frontmatter in that folder's README`, report.roles);
  }
  if (report.skills.length > 0) {
    console.log("");
    printCount(`Not shipped skills; move each to ${harnessDirectory}/${customSkillsPath}/ so agents find it`, report.skills);
  }
  if (report.stale.length > 0) {
    console.log("");
    printCount(`Still say "node Agents/..."; change them to "node ${harnessDirectory}/Agents/..."`, report.stale);
  }
  if (report.entryReview) {
    console.log(`\n${entryFile} keeps your own text. Check it for older harness instructions that still point at Agents/ or Human/ at the project root; they now live in ${harnessDirectory}/.`);
  }
  if (report.exposed.length > 0) {
    console.log("");
    printCount(`Gitignored now but not after the move; add ignore rules for these ${harnessDirectory}/ paths and commit before migrating`, report.exposed);
  }
  if (report.lanes.length > 0) {
    console.log("");
    printCount("Other open task lanes; each merges main after this lands (Git follows the renames). Their human-sync packets keep the old root scope, so capture or hand off any pending drafts there before they merge", report.lanes);
  }
  if (!options.dryRun) console.log(`\nReview the move in this lane, then integrate it with: node ${projectCliPath} worktree approve --approved "<message>"`);
  else console.log(`\nRun the same command without --dry-run to move it.`);
}

function printCount(label, paths) {
  console.log(`${label}: ${paths.length}`);
  for (const relativePath of paths) console.log(`  - ${relativePath}`);
}
