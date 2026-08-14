# turnado

Personal medical care tracker — see [issue #1](https://github.com/uriagassi/turnado/issues/1) for the full spec.

## Development

```bash
npm install
npm run dev      # starts the server (tsx watch) on config's server.port
```

In a second terminal, for hot-reloading client development:

```bash
cd client && npm run dev
```

The client dev server proxies `/api` and `/auth` to the app server.

For a production-shaped run (server serving the built client):

```bash
npm run build     # builds client/dist
npm run start     # runs the server, which serves client/dist
```

### Config

`config/default.json` is committed with generic placeholders. Real deployment
values (hostnames, TLS cert paths, the shared-DB path, outbound-mail
credentials, the shared Notebook id, and the two-username allow-list) go in
`config/local.json`, which is gitignored and layered on top by the
[`config`](https://www.npmjs.com/package/config) package.

For local development without a real household-NAS SSO to talk to, leave
`auth.handler` at its default (`EmptyAuth`) and set `auth.devUserName` in
`config/local.json` to one of the usernames in `security.allowList`.

### Tests

```bash
npm test   # runs the server test suite (vitest)
```
