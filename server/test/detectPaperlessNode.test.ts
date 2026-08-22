import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  wellKnownPaperlessNodeDirs,
  findPaperlessNodeInstall,
  detectPaperlessNode,
} from "../src/setup/detectPaperlessNode.js";

describe("wellKnownPaperlessNodeDirs", () => {
  it("proposes a sibling checkout next to this repo, and one in the home dir", () => {
    const root = path.parse(process.cwd()).root;
    const turnadoRoot = path.join(root, "repos", "turnado");
    const home = path.join(root, "home", "uri");
    const dirs = wellKnownPaperlessNodeDirs(turnadoRoot, home);
    expect(dirs).toEqual([
      path.join(root, "repos", "paperless.node"),
      path.join(home, "paperless.node"),
    ]);
  });
});

describe("findPaperlessNodeInstall / detectPaperlessNode", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  function tmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turnado-detect-"));
    tmpDirs.push(dir);
    return dir;
  }

  function writeInstall(
    dir: string,
    defaultJson: object,
    localJson: object | undefined = undefined
  ) {
    fs.mkdirSync(path.join(dir, "config"), { recursive: true });
    fs.writeFileSync(path.join(dir, "config", "default.json"), JSON.stringify(defaultJson));
    if (localJson !== undefined) {
      fs.writeFileSync(path.join(dir, "config", "local.json"), JSON.stringify(localJson));
    }
  }

  it("returns null when none of the candidate dirs has a config/local.json", () => {
    const empty = tmpDir();
    expect(findPaperlessNodeInstall([empty, "/does/not/exist"])).toBeNull();
    expect(detectPaperlessNode([empty, "/does/not/exist"])).toBeNull();
  });

  it("picks the first candidate dir that has a config/local.json", () => {
    const noInstall = tmpDir();
    const install = tmpDir();
    writeInstall(install, { paperless: { baseDir: "~/paperless" } }, { paperless: { baseDir: "/data/paperless" } });
    expect(findPaperlessNodeInstall([noInstall, install])).toBe(install);
  });

  it("derives db.path and attachments.dir from paperless.baseDir, merged over that install's own defaults", () => {
    const install = tmpDir();
    writeInstall(
      install,
      { paperless: { baseDir: "~/paperless" } },
      { paperless: { baseDir: "/data/paperless" } }
    );
    const detected = detectPaperlessNode([install]);
    expect(detected).toEqual({
      dbPath: path.join("/data/paperless", "paperless.sqlite"),
      attachmentsDir: path.join("/data/paperless", "attachments"),
    });
  });

  it("expands a leading ~ in baseDir when local.json doesn't override it", () => {
    const install = tmpDir();
    writeInstall(install, { paperless: { baseDir: "~/paperless" } }, {});
    const detected = detectPaperlessNode([install]);
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    expect(detected?.dbPath).toBe(path.join(home, "paperless", "paperless.sqlite"));
  });

  it("includes https key/cert paths only when the install has https.use === true", () => {
    const install = tmpDir();
    writeInstall(
      install,
      { paperless: { baseDir: "/data/paperless" }, https: { use: false } },
      { https: { use: true, key: "/certs/key.pem", cert: "/certs/cert.pem" } }
    );
    const detected = detectPaperlessNode([install]);
    expect(detected).toEqual({
      dbPath: path.join("/data/paperless", "paperless.sqlite"),
      attachmentsDir: path.join("/data/paperless", "attachments"),
      httpsKeyPath: "/certs/key.pem",
      httpsCertPath: "/certs/cert.pem",
    });
  });

  it("omits https paths when https.use is false", () => {
    const install = tmpDir();
    writeInstall(
      install,
      { paperless: { baseDir: "/data/paperless" }, https: { use: false } },
      {}
    );
    const detected = detectPaperlessNode([install]);
    expect(detected?.httpsKeyPath).toBeUndefined();
    expect(detected?.httpsCertPath).toBeUndefined();
  });

  it("returns null when the merged config has no usable paperless.baseDir", () => {
    const install = tmpDir();
    writeInstall(install, {}, {});
    expect(detectPaperlessNode([install])).toBeNull();
  });
});
