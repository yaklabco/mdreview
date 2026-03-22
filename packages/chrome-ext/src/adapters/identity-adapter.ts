import type { IdentityAdapter } from '@mdreview/core';
import { sendChromeMessage } from './chrome-message';

export class ChromeIdentityAdapter implements IdentityAdapter {
  async getUsername(): Promise<string> {
    try {
      const resp = await sendChromeMessage<{ username?: string }>({
        type: 'GET_USERNAME',
      });
      return resp?.username ?? '';
    } catch {
      // Native host may not be installed
      return '';
    }
  }
}
