/**
 * Type-safe helper to send a Chrome runtime message and parse the response.
 */
export async function sendChromeMessage<T>(
  message: Record<string, unknown>
): Promise<T | undefined> {
  const result: unknown = await chrome.runtime.sendMessage(message);
  return result as T | undefined;
}
