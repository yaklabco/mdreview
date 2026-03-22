import type { IdentityAdapter } from '@mdreview/core/node';
import { userInfo } from 'os';

export class ElectronIdentityAdapter implements IdentityAdapter {
  getUsername(): Promise<string> {
    return Promise.resolve(userInfo().username);
  }
}
