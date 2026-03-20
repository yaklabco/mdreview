import { describe, it, expect } from 'vitest';
import { ElectronIdentityAdapter } from './identity-adapter';
import { userInfo } from 'os';

describe('ElectronIdentityAdapter', () => {
  it('should return a non-empty string', async () => {
    const adapter = new ElectronIdentityAdapter();
    const username = await adapter.getUsername();
    expect(username).toBeTruthy();
    expect(typeof username).toBe('string');
  });

  it('should return the OS username', async () => {
    const adapter = new ElectronIdentityAdapter();
    const username = await adapter.getUsername();
    expect(username).toBe(userInfo().username);
  });
});
