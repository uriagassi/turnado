import { describe, it, expect, vi, afterEach } from "vitest";
import { GChatMailer, FallbackMailer, requireGChatCredentials } from "../src/reminders/GChatMailer.js";

const config = { clientId: "id", clientSecret: "secret", refreshToken: "refresh" };
const content = { subject: "Reminder: MRI tomorrow", body: "Doctor: Dr. Cohen" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(handlers: Record<string, () => Response>) {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected request: ${String(url)}`);
    return handlers[key]();
  });
}

describe("GChatMailer", () => {
  it("finds the DM space and posts the reminder into it", async () => {
    const fetchStub = stubFetch({
      "oauth2.googleapis.com": () => json({ access_token: "tok", expires_in: 3600 }),
      "findDirectMessage": () => json({ name: "spaces/AAA" }),
      "spaces/AAA/messages": () => json({ name: "spaces/AAA/messages/1" }),
    });

    await new GChatMailer(config, fetchStub as unknown as typeof fetch).send("alice@example.com", content);

    const post = fetchStub.mock.calls.find(([u]) => String(u).endsWith("spaces/AAA/messages"))!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      text: "*Reminder: MRI tomorrow*\nDoctor: Dr. Cohen",
    });
    expect((post[1] as RequestInit).headers).toMatchObject({ authorization: "Bearer tok" });
  });

  it("creates the DM when none exists, then caches the space and access token", async () => {
    const fetchStub = stubFetch({
      "oauth2.googleapis.com": () => json({ access_token: "tok", expires_in: 3600 }),
      "findDirectMessage": () => json({ error: "nope" }, 404),
      "spaces:setup": () => json({ name: "spaces/BBB" }),
      "spaces/BBB/messages": () => json({ name: "m" }),
    });
    const mailer = new GChatMailer(config, fetchStub as unknown as typeof fetch);

    await mailer.send("bob@example.com", content);
    await mailer.send("bob@example.com", content);

    const urls = fetchStub.mock.calls.map(([u]) => String(u));
    expect(urls.filter((u) => u.includes("oauth2"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("findDirectMessage"))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith("spaces/BBB/messages"))).toHaveLength(2);
  });

  it("rejects when the DM cannot be created", async () => {
    const fetchStub = stubFetch({
      "oauth2.googleapis.com": () => json({ access_token: "tok", expires_in: 3600 }),
      "findDirectMessage": () => json({}, 404),
      "spaces:setup": () => json({ error: "forbidden" }, 403),
    });

    await expect(
      new GChatMailer(config, fetchStub as unknown as typeof fetch).send("x@gmail.com", content),
    ).rejects.toThrow("403");
  });
});

describe("GChatMailer error handling", () => {
  const token = { "oauth2.googleapis.com": () => json({ access_token: "tok", expires_in: 3600 }) };
  const urls = (stub: ReturnType<typeof stubFetch>) => stub.mock.calls.map(([u]) => String(u));

  it("does not create a space when findDirectMessage fails for a non-404 reason", async () => {
    const fetchStub = stubFetch({ ...token, findDirectMessage: () => json({}, 403) });
    await expect(
      new GChatMailer(config, fetchStub as unknown as typeof fetch).send("a@example.com", content),
    ).rejects.toThrow("403");
    expect(urls(fetchStub).some((u) => u.includes("spaces:setup"))).toBe(false);
  });

  it("forgets a cached space when posting to it returns 404", async () => {
    let posts = 0;
    const fetchStub = stubFetch({
      ...token,
      findDirectMessage: () => json({ name: "spaces/CCC" }),
      "spaces/CCC/messages": () => (posts++ === 0 ? json({}, 404) : json({ name: "m" })),
    });
    const mailer = new GChatMailer(config, fetchStub as unknown as typeof fetch);

    await expect(mailer.send("a@example.com", content)).rejects.toThrow("404");
    await mailer.send("a@example.com", content);

    expect(urls(fetchStub).filter((u) => u.includes("findDirectMessage"))).toHaveLength(2);
  });

  it("shares one token refresh between concurrent sends", async () => {
    const fetchStub = stubFetch({
      ...token,
      findDirectMessage: () => json({ name: "spaces/DDD" }),
      "spaces/DDD/messages": () => json({ name: "m" }),
    });
    const mailer = new GChatMailer(config, fetchStub as unknown as typeof fetch);

    await Promise.all([mailer.send("a@example.com", content), mailer.send("a@example.com", content)]);

    expect(urls(fetchStub).filter((u) => u.includes("oauth2"))).toHaveLength(1);
  });
});

describe("requireGChatCredentials", () => {
  it("rejects a refresh token without client credentials", () => {
    expect(() => requireGChatCredentials({ clientId: "", clientSecret: "", refreshToken: "r" })).toThrow(
      "gchat.clientId",
    );
  });
});

describe("FallbackMailer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not touch the fallback when the primary succeeds", async () => {
    const primary = { send: vi.fn().mockResolvedValue(undefined) };
    const fallback = { send: vi.fn() };
    await new FallbackMailer(primary, fallback).send("a@example.com", content);
    expect(fallback.send).not.toHaveBeenCalled();
  });

  it("sends through the fallback when the primary fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = { send: vi.fn().mockRejectedValue(new Error("chat down")) };
    const fallback = { send: vi.fn().mockResolvedValue(undefined) };
    await new FallbackMailer(primary, fallback).send("a@example.com", content);
    expect(fallback.send).toHaveBeenCalledWith("a@example.com", content);
  });

  it("propagates the fallback's failure so ReminderService can retry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = { send: vi.fn().mockRejectedValue(new Error("chat down")) };
    const fallback = { send: vi.fn().mockRejectedValue(new Error("smtp down")) };
    await expect(new FallbackMailer(primary, fallback).send("a@example.com", content)).rejects.toThrow("smtp down");
  });
});
