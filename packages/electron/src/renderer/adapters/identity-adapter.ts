import type { IdentityAdapter } from '@mdview/core';

export class ElectronRendererIdentityAdapter implements IdentityAdapter {
  async getUsername(): Promise<string> {
    return window.mdview.getUsername();
  }
}
