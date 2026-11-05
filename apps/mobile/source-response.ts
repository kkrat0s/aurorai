/** Preserve useful server diagnostics while keeping response bodies out of logs. */
export function sourceErrorDetails(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  const details: string[] = [];
  if (typeof record.error === 'string' && record.error.trim()) details.push(record.error.trim());
  if (Array.isArray(record.errors)) {
    details.push(...record.errors.filter((item): item is string => typeof item === 'string' && !!item.trim()).map(item => item.trim()));
  }
  return [...new Set(details)];
}

export async function readSourceJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = sourceErrorDetails(body).join(' ');
    throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
  }
  return body as T;
}

export function sourceRequestFailure(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message.trim();
  return 'network request failed';
}
