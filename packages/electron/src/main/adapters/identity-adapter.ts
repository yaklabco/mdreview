import type { IdentityAdapter } from '@mdview/core';
import { userInfo } from 'os';

export class ElectronIdentityAdapter implements IdentityAdapter {
  getUsername(): Promise<string> {
    return Promise.resolve(userInfo().username);
  }
}
