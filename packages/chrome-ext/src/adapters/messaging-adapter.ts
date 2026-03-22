import type { MessagingAdapter, IPCMessage } from '@mdreview/core';

export class ChromeMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }
}
