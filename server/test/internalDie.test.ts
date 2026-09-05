import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp, isLoopbackAddress } from "../src/app.js";
import { StubAuthHandler } from "./support/StubAuthHandler.js";
import { singleUserAllowList } from "./support/allowListFixture.js";

// POST /internal/die is the NAS control script's way of asking an
// already-running instance to shut itself down before a new one starts —
// see the comment above the route in app.ts and docs/nas-deployment-notes.md.
describe("POST /internal/die", () => {
  it("terminates the process without requiring auth", async () => {
    const exitProcess = vi.fn();
    const app = createApp({
      authHandler: new StubAuthHandler(),
      allowList: singleUserAllowList(),
      cookieSecret: "test-secret",
      exitProcess,
    });

    // No cookies set (unlike a signed-in agent elsewhere) — this route sits
    // ahead of the auth middleware on purpose.
    await request(app).post("/internal/die").expect(200);

    expect(exitProcess).toHaveBeenCalledWith(0);
  });
});

// supertest's in-process requests always arrive from 127.0.0.1, so the
// route's off-box rejection is exercised directly against the guard instead.
describe("isLoopbackAddress", () => {
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("accepts %s", (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  it.each(["203.0.113.5", "10.100.102.204", undefined])("rejects %s", (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});
