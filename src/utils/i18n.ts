import enGb from "@/i18n/en-GB.json";

const strings = enGb as Record<string, string>;

export function t(
  key: string,
  values?: Record<string, string | number>,
): string {
  const template = strings[key] ?? key;
  if (!values) return template;
  return Object.entries(values).reduce(function replaceToken(
    result,
    [token, value],
  ) {
    return result.split(`{${token}}`).join(String(value));
  }, template);
}
