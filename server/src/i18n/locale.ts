export interface ResolveLocaleParams {
  userName: string | undefined;
  queryLocale: string | undefined;
  allowList: Record<string, string>;
  supportedLocales: string[];
  fallbackLocale: string;
}

export function resolveLocale(params: ResolveLocaleParams): string {
  const { userName, queryLocale, allowList, supportedLocales } = params;
  if (queryLocale && supportedLocales.includes(queryLocale)) {
    return queryLocale;
  }
  if (userName && allowList[userName]) {
    return allowList[userName];
  }
  return params.fallbackLocale;
}
