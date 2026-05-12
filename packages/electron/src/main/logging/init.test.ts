import { describe, it, expect } from 'vitest';
import { buildLogging, buildMainResource } from './init';
import { FileTransport } from './file-transport';

describe('buildMainResource', () => {
  it('builds expected attributes for packaged build', () => {
    const r = buildMainResource({ version: '1.2.3', platform: 'darwin', isPackaged: true });
    expect(r).toEqual({
      'service.name': 'mdview',
      'service.version': '1.2.3',
      'service.namespace': 'electron-main',
      'deployment.environment': 'prod',
      'host.os': 'darwin',
    });
  });

  it('uses dev environment when not packaged', () => {
    const r = buildMainResource({ version: '0.0.0-dev', platform: 'linux', isPackaged: false });
    expect(r['deployment.environment']).toBe('dev');
    expect(r['service.version']).toBe('0.0.0-dev');
    expect(r['host.os']).toBe('linux');
  });
});

describe('buildLogging', () => {
  it('returns a FileTransport and a matching resource', () => {
    const { transport, resource } = buildLogging({
      version: '9.9.9',
      platform: 'win32',
      isPackaged: false,
    });
    expect(transport).toBeInstanceOf(FileTransport);
    expect(resource['service.namespace']).toBe('electron-main');
    expect(resource['service.version']).toBe('9.9.9');
    expect(resource['host.os']).toBe('win32');
  });
});
