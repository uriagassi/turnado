# Google Chat reminders: one-time setup

Reminders are sent as Google Chat DMs from a dedicated Workspace sender account, using user OAuth. Recipients Chat can't reach (for example outside the Workspace domain) get email instead. Leave `gchat.refreshToken` empty to stay email-only.

1. In a GCP project owned by the Workspace org, enable the **Google Chat API**.
2. In the Chat API **Configuration** tab, configure a Chat app (name, avatar, description). Interactive features can stay off, and a placeholder connection endpoint is fine because Turnado never receives events. Make it visible to the sender and the recipients.
3. Set the OAuth consent screen to **Internal** and create an OAuth client of type **Desktop app**. If the Workspace restricts third-party apps, mark the client as trusted in the Admin console (Security → API controls).
4. Run `npm run setup_wizard` and answer yes to the Google Chat step. Sign in as the sender account when prompted.

Notes:
- Use a sender that is not itself a reminder recipient. Messages sent to yourself may not notify.
- If Chat fails for any reason (revoked token, quota, unreachable recipient), the server logs a warning and sends email.
- Rarely, a DM is delivered but its response is lost, in which case the recipient also gets the email.
