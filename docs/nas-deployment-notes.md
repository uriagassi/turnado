# Working with the household NAS

Notes from actually deploying turnado to the Synology NAS for the first time
(alongside the existing `paperless.node` install), for whoever picks up NAS
work next — human or agent. The NAS itself keeps a companion file with
NAS-side operational knowledge (filesystem layout, running apps, process
supervision gotchas): **`/volume1/MainBackup/server/NAS-NOTES.md`** — read it
too before doing anything non-trivial on the box.

## Access

- Host `10.100.102.204`, SSH port `2222`. Public hostname `home.agassi.co.il`
  (real cert via acme.sh, not self-signed) is how the NAS is actually reached
  day-to-day; the raw IP is only relevant for the SSH hop.
- Model: Synology DS220+ (`synology_geminilake_220+`), DSM reachable at
  `https://home.agassi.co.il:5001`.
- Dedicated non-admin account `agent`, created specifically for this kind of
  work. No sudo, not in the administrators group. Scoped to: read/write on
  its own app directories, read-only on sibling apps' config, read/write on
  the shared paperless DB/attachments paths. **Cannot** touch anything
  root-owned — notably `/usr/local/etc/rc.d/*.sh` (the actual boot-trigger
  scripts) are `root`-only and invisible/unwritable to `agent`.
- SSH key-based login, dedicated passphrase-less keypair generated for this
  (not a personal key): `~/.ssh/turnado_agent` / `turnado_agent.pub` on this
  machine. If key auth to a *new* account mysteriously fails with
  `Permission denied (publickey,password)` even though the key is in
  `authorized_keys`, it's almost always DSM's strict `sshd` permission check:
  home dir `700`, `.ssh` `700`, `authorized_keys` `600`, all owned by that
  user — and Synology layers ACLs on top of POSIX permissions that can
  override a correct `chmod`, so also check `ls -le` for stray `+` entries
  and `synoacltool -del <path>` them if present.
- `scp` is disabled/broken on this NAS's `sshd` (`subsystem request failed`).
  Use `ssh host 'cat > file' < localfile` for transfers instead — works for
  arbitrary binary/UTF-8 content, including the Hebrew allow-list tag names
  in turnado's config.

## Environment gotchas that cost real debugging time

- **Multiple Node.js versions coexist** under `/volume1/@appstore/Node.js_v18`,
  `_v20`, `_v22` (installed via Package Center). `/usr/local/bin/node` is a
  symlink to whichever is "current" — **it can change under you** (it did,
  mid-session, from v20 to v22, breaking the already-running paperless.node
  process's native deps). Any persistent control script should pin the
  *exact* version path (`/volume1/@appstore/Node.js_v20/usr/local/bin/node`),
  never rely on the default symlink.
- `agent`'s default `PATH` is just `/usr/bin:/bin:/usr/sbin:/sbin` — `node`,
  `npm`, `git`, `yarn`, `forever` all live under `/usr/local/bin` but aren't
  on it by default. Every script needs an explicit
  `export PATH="<node-version-dir>:/usr/local/bin:$PATH"`.
- **No C compiler toolchain anywhere** on this NAS (no `gcc`/`make`/`cc`).
  Any native npm module (`better-sqlite3`, etc.) *must* resolve to a
  prebuilt binary — if a package's latest release dropped prebuilds for an
  older Node ABI, `npm install` fails with no useful path forward except
  pinning to an older package version that still ships that ABI's prebuild
  (check `https://api.github.com/repos/<owner>/<repo>/releases/tags/vX.Y.Z`
  for the actual asset list, matching `node-vNNN-<platform>-<arch>` against
  `process.versions.modules` for the target Node version).
- **Small-ICU Node build**: `Intl.DateTimeFormat(locale, {...}).format()`
  can silently substitute a *different* locale's rendering when the
  requested locale's data isn't installed, instead of throwing. Never trust
  a locale template's implicit output shape (e.g. assuming `"en-CA"` always
  renders `YYYY-MM-DD`) — use `formatToParts()` and assemble the string from
  named fields, which stays correct regardless of installed locale data.
- **`forever`'s process list is per-user** (`~/.forever`) — `agent` and
  `root` each see a completely disjoint `forever list`. A process one
  account started is invisible to `forever list` run as the other. This is
  *why* paperless.node and turnado can be supervised independently by
  different accounts without conflict, but also why "no forever processes
  running" doesn't mean nothing is actually running.
- **Supervising `npm run <script>` (or any nested npm/yarn wrapper) doesn't
  reliably let `forever stop` kill the real process** — npm/yarn spawn a
  child that survives its immediate parent being killed. Point `forever`
  directly at the real binary (e.g. `tsx`) instead of through a
  `npm run`/`yarn` indirection layer.
- Even that isn't fully clean: `tsx`'s own CLI wrapper spawns a *further*
  child (the actual worker, with its own `--require`/`--import` flags)
  rather than exec-replacing itself, so `forever`'s kill only reaches the
  CLI shim. Always verify a full start/stop cycle leaves zero orphaned
  processes (`ps -ef | grep <app>`) before trusting a supervision setup —
  don't assume "forever says stopped" means the port is actually free.
- **Never use a broad `killall`/`pkill -f <generic-pattern>`** to stop one
  app on this box — paperless.node's own `stop()` uses `killall -9 node`,
  which would kill turnado too. Any cleanup kill must be scoped tightly to
  the specific app's absolute entry-script path.
- `pkill -f "<pattern>"` can match **its own invoking shell's command
  line** if that exact substring appears anywhere in it — this actually
  happened live (killed the SSH session running the command). Prefer
  `ps -ef | grep "[x]pattern"` (bracket trick avoids the grep process
  matching itself) + explicit `kill <pid>`, and double-check the search
  text doesn't also appear in the wrapping script that's issuing the kill.
- Piping multi-line answers into a remote **interactive Node
  `readline/promises` program** over this SSH setup does not reliably
  deliver more than the first line — the process hangs after line one even
  though the whole file was sent (works fine for a simple `cat > file`
  single-read). Root cause not fully diagnosed. Workaround: don't script
  interactive wizards this way — construct the target file directly
  instead.

## What's actually deployed

See `/volume1/MainBackup/server/NAS-NOTES.md` on the NAS for the full
picture (paths, running apps, control scripts, log locations). Summary:
turnado lives at `/volume1/MainBackup/server/turnado`, shares
paperless.node's SQLite DB/attachments dir and TLS cert, runs under
`forever` via a root-owned `/usr/local/etc/rc.d/turnadocontrol.sh` boot
script, and authenticates via its own Synology SSO Application Portal
registration (separate `app_id`/redirect URI from paperless.node's).
