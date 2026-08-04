export function safeReturnTo(
  requestedTarget: string | null,
  requestUrl: string,
): string {
  if (!requestedTarget) return "/";

  try {
    const requestOrigin = new URL(requestUrl);
    const target = new URL(requestedTarget, requestOrigin);
    if (target.origin !== requestOrigin.origin) return "/";

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
