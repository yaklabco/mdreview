import type { MessagingAdapter, IPCMessage } from '@mdview/core';

export class ChromeMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }
}
