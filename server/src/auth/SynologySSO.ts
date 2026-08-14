import { SimpleOAuth } from "./SimpleOAuth.js";
import config from "../config.js";

/**
 * Production auth handler: the household-NAS (Synology) single sign-on,
 * duplicated from the sibling document-archive app. Selected via
 * config's `auth.handler` in deployment config (config/local.json).
 */
export class AuthHandler extends SimpleOAuth {
  // The hostname:port pair and the OAuth query params are each read from
  // config in three places (login/logout href, token exchange); factored
  // out once here instead of repeating the config.get() calls at each
  // call site.
  private baseUrl(): string {
    return `https://${config.get("synology.hostname")}:${config.get("synology.port")}`;
  }

  private oAuthParams(): string {
    return `scope=user_id&redirect_uri=${config.get("synology.redirect_uri")}&synossoJSSDK=false&app_id=${config.get(
      "synology.appId"
    )}`;
  }

  clientData(): { handler: string; loginHref: string; logoutHref: string } {
    const ssoUrl = `${this.baseUrl()}/webman/sso/SSOOauth.cgi?${this.oAuthParams()}`;
    return {
      handler: "SynologySSO",
      loginHref: ssoUrl,
      logoutHref: `${ssoUrl}&method=logout`,
    };
  }

  oAuthUrl(token: string): string {
    return `${this.baseUrl()}/webman/sso/SSOAccessToken.cgi?action=exchange&app_id=${config.get(
      "synology.appId"
    )}&access_token=${encodeURIComponent(token)}`;
  }

  shouldRejectUnauthorized(): boolean {
    return !(config.has("synology.self_signed") && config.get("synology.self_signed") === "Y");
  }
}
