import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Regression coverage for a real deployment bug: the Synology SSO redirect
// comes back with the token as a URL fragment (#access_token=...), which
// browsers never send to the server. fetchCurrentUser() has to read it
// client-side and forward it as an x-access-token header instead — see
// api.ts's accessTokenFromHash() comment for the full story. The token is
// captured once at module load, so each case here resets modules and
// re-imports fresh with window.location already set the way it would be
// right after the SSO redirect lands.
describe("fetchCurrentUser — SSO fragment token", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
    vi.unstubAllGlobals();
  });

  function setLocation(hash: string, search = "") {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, pathname: "/", search, hash },
      writable: true,
    });
  }

  it("forwards the fragment's access_token as an x-access-token header", async () => {
    setLocation("#access_token=abc123&state=");
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ userId: "u", userName: "u", locale: "en" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCurrentUser } = await import("./api");
    await fetchCurrentUser();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["x-access-token"]).toBe("abc123");
  });

  it("clears the fragment from the visible URL after reading it", async () => {
    setLocation("#access_token=abc123&state=");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }))
    );
    const replaceStateSpy = vi.spyOn(history, "replaceState");

    await import("./api");

    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/");
  });

  it("sends no x-access-token header when there's no fragment token", async () => {
    setLocation("");
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCurrentUser } = await import("./api");
    await fetchCurrentUser();

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toBeUndefined();
  });

  it("still propagates the page's own query string alongside a fragment token", async () => {
    setLocation("#access_token=abc123", "?lang=he");
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCurrentUser } = await import("./api");
    await fetchCurrentUser();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/user?lang=he");
  });
});
