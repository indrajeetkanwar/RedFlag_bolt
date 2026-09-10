#!/usr/bin/env node
/**
 * PreToolUse / Bash hook — block Claude from writing to the `main` branch.
 *
 * Project policy: all work goes to `develop_vsCode`; `main` only changes via a PR.
 * This denies `git commit` / `git merge` / `git push` / force `git branch` when the
 * command targets `main` or would run while HEAD is on `main`.
 *
 * Fail-open: any error here → allow, so a bug in the hook never blocks all git use.
 * Deliberate bypass (rare): run the git command yourself in a terminal, or
 * temporarily disable the hook via /hooks.
 */
import { execSync } from 'node:child_process';

const REASON =
  "Blocked: direct writes to 'main' are not allowed on this project. " +
  'Switch to develop_vsCode (`git checkout develop_vsCode`) and open a PR to merge into main.';

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

let input = '';
try {
  input = await new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (buf += d));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
} catch {
  allow();
}

let cmd = '';
try {
  cmd = String(JSON.parse(input)?.tool_input?.command ?? '');
} catch {
  allow();
}

// Blank out quoted strings so a commit message / echo text that happens to contain
// "git checkout main" or "git push origin main" doesn't trip the patterns below.
const scrub = cmd.replace(/"[\s\S]*?"/g, '""').replace(/'[\s\S]*?'/g, "''");

if (!/\bgit\b/.test(scrub)) allow();

const lc = scrub.toLowerCase();

let branch = '';
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
} catch {
  branch = '';
}

const onMain = branch === 'main';

// "main" used as a ref/target: "origin main", "HEAD:main", ":main", "+main",
// "refs/heads/main" — but not "maintenance".
const targetsMain = /(^|[\s:/+])main($|[\s"'])/.test(lc);

// git checkout/switch to main chained with a write in the same command.
const switchesToMain = /\bgit\s+(checkout|switch)\s+(-[a-z]+\s+)*main($|[\s"'&;|])/.test(lc);
const hasWrite = /\bgit\s+(commit|merge|push)\b/.test(lc);

const isPush = /\bgit\s+push\b/.test(lc);
const isCommitOrMerge = /\bgit\s+(commit|merge)\b/.test(lc);
const isForce = /(\s|^)(--force|-f|--force-with-lease)(\s|$)/.test(lc);

// Force-move / delete / rename of main.
const forcesMainBranch =
  /\bgit\s+branch\s+(-[a-zdfm]+|--force|--delete|--move)\b[^\n]*?(^|[\s=])main($|[\s"'])/.test(lc);

if (switchesToMain && hasWrite) deny(REASON);
if (forcesMainBranch) deny(REASON);

if (isPush) {
  if (targetsMain) deny(REASON);
  if (isForce && onMain) deny(REASON);
  // "bare" push (no explicit branch/refspec) while HEAD is main pushes main itself.
  if (onMain) {
    const rest = scrub
      .replace(/.*\bgit\s+push\s+/is, '')
      .replace(/(--[a-z-]+|-[a-z]+)(\s+[^\s-]\S*)?/gi, '') // drop flags (+ their arg)
      .trim();
    const bare = !/\S\s+\S/.test(rest); // nothing, or a lone remote name
    if (bare) deny(REASON);
  }
}

if (isCommitOrMerge && onMain) deny(REASON);

allow();
