import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { StubAuthHandler } from "./support/StubAuthHandler.js";
import { twoUserAllowList } from "./support/allowListFixture.js";

const allowList = twoUserAllowList();
const cookieSecret = "test-secret";

function appWithAllowList() {
  return createApp({ authHandler: new StubAuthHandler(), allowList, cookieSecret });
}

/**
 * Logs in as the given user via a fresh handshake and returns the signed
 * `x-token-user` session cookie the server set — for reuse against a
 * separate app instance whose StubAuthHandler has no fixed user, proving
 * the request was satisfied by the cookie shortcut and not a fresh
 * handshake (see StubAuthHandler's own doc comment).
 */
async function signedInCookie(userId: string, userName: string): Promise<string> {
  const app = createApp({
    authHandler: new StubAuthHandler({ user_id: userId, user_name: userName }),
    allowList,
    cookieSecret,
  });
  const res = await request(app).get("/api/home");
  const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const tokenCookie = setCookie.find((c) => c.startsWith("x-token-user="));
  if (!tokenCookie) throw new Error("expected a x-token-user cookie to be set on first login");
  return tokenCookie.split(";")[0];
}

describe("auth allow-list, across every route in the app", () => {
  it("lets an allow-listed SSO user reach /api/user via the signed session cookie", async () => {
    const cookie = await signedInCookie("1", "alice");
    const res = await request(appWithAllowList()).get("/api/user").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.userName).toBe("alice");
  });

  it("carries the user's id along with their name on a cookie-shortcut request, not just the name", async () => {
    // Regression test: the session cookie used to store only the
    // username, so a request served by the shortcut (rather than a
    // fresh handshake) reported userId as undefined.
    const cookie = await signedInCookie("42", "alice");
    const res = await request(appWithAllowList()).get("/api/user").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("42");
    expect(res.body.userName).toBe("alice");
  });


  it("lets an allow-listed SSO user reach /api/home via the signed session cookie", async () => {
    const cookie = await signedInCookie("1", "alice");
    const res = await request(appWithAllowList()).get("/api/home").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("rejects a validated-but-non-allow-listed SSO user on /api/user with a clean not-authorized response", async () => {
    const cookie = await signedInCookie("9", "mallory");
    const res = await request(appWithAllowList()).get("/api/user").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("rejects a validated-but-non-allow-listed SSO user on /api/home", async () => {
    const cookie = await signedInCookie("9", "mallory");
    const res = await request(appWithAllowList()).get("/api/home").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("lets an allow-listed user through on first login too, before any cookie exists", async () => {
    const app = createApp({
      authHandler: new StubAuthHandler({ user_id: "1", user_name: "alice" }),
      allowList,
      cookieSecret,
    });
    const res = await request(app).get("/api/home");
    expect(res.status).toBe(200);
  });

  it("rejects a non-allow-listed user on first login too, before any cookie exists", async () => {
    const app = createApp({
      authHandler: new StubAuthHandler({ user_id: "9", user_name: "mallory" }),
      allowList,
      cookieSecret,
    });
    const res = await request(app).get("/api/home");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("never blocks the pre-login /auth endpoint, allow-listed or not", async () => {
    const res = await request(appWithAllowList()).get("/auth");
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe("StubAuthHandler");
  });

  it("rejects a forged, unsigned x-token-user cookie instead of trusting it as a session shortcut", async () => {
    // Regression test for the auth-bypass fix: Auth.ts's cookie shortcut
    // must only trust a cryptographically signed cookie value, never an
    // arbitrary client-supplied one. With no signed cookie present, this
    // falls through to StubAuthHandler().authorize(), which — with no
    // fixed user configured — throws, which Auth.ts turns into a 401.
    const res = await request(appWithAllowList()).get("/api/home").set("Cookie", "x-token-user=alice");
    expect(res.status).toBe(401);
  });
});
