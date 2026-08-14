import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { StubAuthHandler } from "./support/StubAuthHandler.js";

const allowList = { alice: "en", bob: "he" };

function appWithAllowList() {
  return createApp({ authHandler: new StubAuthHandler(), allowList });
}

describe("auth allow-list, across every route in the app", () => {
  it("lets an allow-listed SSO user reach /api/user", async () => {
    const res = await request(appWithAllowList()).get("/api/user").set("Cookie", "x-token-user=alice");
    expect(res.status).toBe(200);
    expect(res.body.user_name).toBe("alice");
  });

  it("lets an allow-listed SSO user reach /api/home", async () => {
    const res = await request(appWithAllowList()).get("/api/home").set("Cookie", "x-token-user=alice");
    expect(res.status).toBe(200);
  });

  it("rejects a validated-but-non-allow-listed SSO user on /api/user with a clean not-authorized response", async () => {
    const res = await request(appWithAllowList()).get("/api/user").set("Cookie", "x-token-user=mallory");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("rejects a validated-but-non-allow-listed SSO user on /api/home", async () => {
    const res = await request(appWithAllowList()).get("/api/home").set("Cookie", "x-token-user=mallory");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("lets an allow-listed user through on first login too, before any cookie exists", async () => {
    const app = createApp({ authHandler: new StubAuthHandler({ user_id: "1", user_name: "alice" }), allowList });
    const res = await request(app).get("/api/home");
    expect(res.status).toBe(200);
  });

  it("rejects a non-allow-listed user on first login too, before any cookie exists", async () => {
    const app = createApp({ authHandler: new StubAuthHandler({ user_id: "9", user_name: "mallory" }), allowList });
    const res = await request(app).get("/api/home");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("never blocks the pre-login /auth endpoint, allow-listed or not", async () => {
    const res = await request(appWithAllowList()).get("/auth");
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe("StubAuthHandler");
  });
});
