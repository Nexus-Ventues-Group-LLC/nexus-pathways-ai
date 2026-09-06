const approvedResourcePattern = /^\/learner\/resources\/[a-z0-9-]+$/;

export function approvedResourceHref(route: string): string | null {
  return approvedResourcePattern.test(route) ? route : null;
}