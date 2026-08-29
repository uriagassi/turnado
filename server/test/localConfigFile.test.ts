import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLocalConfig, mergeLocalConfig } from "../src/setup/localConfigFile.js";

describe("readLocalConfig / mergeLocalConfig", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  function tmpConfigPath(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turnado-localcfg-"));
    tmpDirs.push(dir);
    return path.join(dir, "local.json");
  }

  it("reads {} when the file doesn't exist yet (first run of the wizard)", () => {
    expect(readLocalConfig(tmpConfigPath())).toEqual({});
  });

  it("reads back what's on disk", () => {
    const p = tmpConfigPath();
    fs.writeFileSync(p, JSON.stringify({ db: { path: "/data/paperless.sqlite" } }));
    expect(readLocalConfig(p)).toEqual({ db: { path: "/data/paperless.sqlite" } });
  });

  it("writes a patch to a fresh file", () => {
    const p = tmpConfigPath();
    const result = mergeLocalConfig(p, { db: { path: "/data/paperless.sqlite" } });
    expect(result).toEqual({ db: { path: "/data/paperless.sqlite" } });
    expect(JSON.parse(fs.readFileSync(p, "utf-8"))).toEqual({
      db: { path: "/data/paperless.sqlite" },
    });
  });

  it("merges a patch onto the existing file without clobbering unrelated keys — each wizard step only touches its own section", () => {
    const p = tmpConfigPath();
    mergeLocalConfig(p, { db: { path: "/data/paperless.sqlite" } });
    mergeLocalConfig(p, { mail: { host: "smtp.example.com", port: 587 } });
    expect(readLocalConfig(p)).toEqual({
      db: { path: "/data/paperless.sqlite" },
      mail: { host: "smtp.example.com", port: 587 },
    });
  });

  it("a later patch overrides a value an earlier patch set for the same key", () => {
    const p = tmpConfigPath();
    mergeLocalConfig(p, { security: { cookieSecret: "old" } });
    mergeLocalConfig(p, { security: { cookieSecret: "new" } });
    expect(readLocalConfig(p)).toEqual({ security: { cookieSecret: "new" } });
  });
});
