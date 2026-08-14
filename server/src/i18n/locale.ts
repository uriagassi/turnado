import type { AllowList } from "../auth/AllowList.js";

export interface ResolveLocaleParams {
  userName: string | undefined;
  queryLocale: string | undefined;
  allowList: AllowList;
  supportedLocales: string[];
  fallbackLocale: string;
}

export function resolveLocale(params: ResolveLocaleParams): string {
  const { userName, queryLocale, allowList, supportedLocales } = params;
  if (queryLocale && supportedLocales.includes(queryLocale)) {
    return queryLocale;
  }
  const locale = allowList.localeFor(userName);
  if (locale) {
    return locale;
  }
  return params.fallbackLocale;
}
