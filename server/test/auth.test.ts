import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { parseSession } from "../src/auth/Auth.js";
import { SimpleOAuth } from "../src/auth/SimpleOAuth.js";

describe("parseSession", () => {
  it("accepts a well-formed {userId, userName} payload", () => {
    expect(parseSession(JSON.stringify({ userId: "1", userName: "alice" }))).toEqual({
      userId: "1",
      userName: "alice",
    });
  });

  it("rejects a cookie that isn't JSON at all (e.g. the old plain-username shape)", () => {
    expect(parseSession("alice")).toBeUndefined();
  });

  it("rejects JSON that isn't the expected shape", () => {
    expect(parseSession(JSON.stringify("alice"))).toBeUndefined();
    expect(parseSession(JSON.stringify({ userName: "alice" }))).toBeUndefined();
    expect(parseSession(JSON.stringify({ userId: 1, userName: "alice" }))).toBeUndefined();
  });
});

class TestOAuth extends SimpleOAuth {
  clientData() {
    return { handler: "TestOAuth", loginHref: "", logoutHref: "" };
  }

  oAuthUrl(token: string): string {
    return `https://example.test/exchange?access_token=${encodeURIComponent(token)}`;
  }
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe("SimpleOAuth.authorize", () => {
  it("responds 401, not 403, when no token is present — the normal state on a user's first visit", () => {
    // Regression test: 403 made api.ts show the hard "not authorized"
    // screen (and skip the sign-in link) for every brand-new visitor,
    // since they have no token yet until they follow that very link.
    const handler = new TestOAuth();
    const req = { query: {}, body: {}, headers: {}, signedCookies: {} } as unknown as Request;
    const res = mockRes();

    handler.authorize(req, res, () => {
      throw new Error("callback should not be called when no token is present");
    });

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
