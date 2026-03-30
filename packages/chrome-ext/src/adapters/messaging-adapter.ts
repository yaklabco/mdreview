import type { MessagingAdapter, IPCMessage } from '@mdreview/core';

/** Timeout (ms) for service worker message round-trips. */
const MESSAGE_TIMEOUT = 2000;

export class ChromeMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    return Promise.race([
      chrome.runtime.sendMessage(message),
      new Promise((_resolve, reject) =>
        setTimeout(
          () => reject(new Error(`Service worker message timed out: ${message.type}`)),
          MESSAGE_TIMEOUT
        )
      ),
    ]);
  }
}
