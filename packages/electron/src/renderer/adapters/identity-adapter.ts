import type { IdentityAdapter } from '@mdreview/core';

export class ElectronRendererIdentityAdapter implements IdentityAdapter {
  async getUsername(): Promise<string> {
    return window.mdreview.getUsername();
  }
}
