import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock simple-git before importing the service
const mockGit = {
  checkIsRepo: vi.fn(),
  branchLocal: vi.fn(),
  checkout: vi.fn(),
  status: vi.fn(),
  add: vi.fn(),
  reset: vi.fn(),
  commit: vi.fn(),
};

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGit),
}));

const { ElectronGitService } = await import('./git-service');

describe('ElectronGitService', () => {
  let service: InstanceType<typeof ElectronGitService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ElectronGitService('/tmp/test-repo');
  });

  describe('isGitRepo', () => {
    it('should return true when simple-git says it is a repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      const result = await service.isGitRepo();
      expect(result).toBe(true);
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    it('should return false when not a repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);
      const result = await service.isGitRepo();
      expect(result).toBe(false);
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('permission denied'));
      await expect(service.isGitRepo()).rejects.toThrow(
        'Failed to check if directory is a git repo: permission denied'
      );
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      mockGit.branchLocal.mockResolvedValue({
        current: 'main',
        all: ['main', 'develop'],
        branches: {},
        detached: false,
      });
      const result = await service.getCurrentBranch();
      expect(result).toBe('main');
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.branchLocal.mockRejectedValue(new Error('not a git repo'));
      await expect(service.getCurrentBranch()).rejects.toThrow(
        'Failed to get current branch: not a git repo'
      );
    });
  });

  describe('listBranches', () => {
    it('should return local branches with current marked', async () => {
      mockGit.branchLocal.mockResolvedValue({
        current: 'develop',
        all: ['main', 'develop', 'feature-x'],
        branches: {},
        detached: false,
      });
      const result = await service.listBranches();
      expect(result).toEqual({
        local: ['main', 'develop', 'feature-x'],
        current: 'develop',
      });
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.branchLocal.mockRejectedValue(new Error('git error'));
      await expect(service.listBranches()).rejects.toThrow('Failed to list branches: git error');
    });
  });

  describe('checkout', () => {
    it('should call git.checkout with the branch name', async () => {
      mockGit.checkout.mockResolvedValue(undefined);
      await service.checkout('feature-branch');
      expect(mockGit.checkout).toHaveBeenCalledWith('feature-branch');
    });

    it('should wrap errors with meaningful message including branch name', async () => {
      mockGit.checkout.mockRejectedValue(new Error('pathspec not found'));
      await expect(service.checkout('nonexistent')).rejects.toThrow(
        'Failed to checkout branch "nonexistent": pathspec not found'
      );
    });
  });

  describe('getStatus', () => {
    it('should map modified files correctly', async () => {
      mockGit.status.mockResolvedValue({
        created: [],
        staged: [],
        modified: ['src/app.ts'],
        deleted: [],
        not_added: [],
        renamed: [],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'src/app.ts',
        status: 'modified',
        staged: false,
      });
    });

    it('should map added (created) files correctly', async () => {
      mockGit.status.mockResolvedValue({
        created: ['new-file.ts'],
        staged: ['new-file.ts'],
        modified: [],
        deleted: [],
        not_added: [],
        renamed: [],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'new-file.ts',
        status: 'added',
        staged: true,
      });
    });

    it('should map deleted files correctly', async () => {
      mockGit.status.mockResolvedValue({
        created: [],
        staged: [],
        modified: [],
        deleted: ['old-file.ts'],
        not_added: [],
        renamed: [],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'old-file.ts',
        status: 'deleted',
        staged: false,
      });
    });

    it('should map untracked files correctly', async () => {
      mockGit.status.mockResolvedValue({
        created: [],
        staged: [],
        modified: [],
        deleted: [],
        not_added: ['untracked.txt'],
        renamed: [],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'untracked.txt',
        status: 'untracked',
        staged: false,
      });
    });

    it('should map renamed files correctly', async () => {
      mockGit.status.mockResolvedValue({
        created: [],
        staged: [],
        modified: [],
        deleted: [],
        not_added: [],
        renamed: [{ from: 'old-name.ts', to: 'new-name.ts' }],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'new-name.ts',
        status: 'renamed',
        staged: true,
      });
    });

    it('should map staged modified files correctly', async () => {
      mockGit.status.mockResolvedValue({
        created: [],
        staged: ['staged-mod.ts'],
        modified: [],
        deleted: [],
        not_added: [],
        renamed: [],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'staged-mod.ts',
        status: 'modified',
        staged: true,
      });
    });

    it('should map conflicted files as modified', async () => {
      mockGit.status.mockResolvedValue({
        created: [],
        staged: [],
        modified: [],
        deleted: [],
        not_added: [],
        renamed: [],
        conflicted: ['conflict.ts'],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toContainEqual({
        path: 'conflict.ts',
        status: 'modified',
        staged: false,
      });
    });

    it('should not duplicate created files that appear in staged array', async () => {
      mockGit.status.mockResolvedValue({
        created: ['new.ts'],
        staged: ['new.ts'],
        modified: [],
        deleted: [],
        not_added: [],
        renamed: [],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      const newFiles = result.filter((f) => f.path === 'new.ts');
      expect(newFiles).toHaveLength(1);
      expect(newFiles[0]).toEqual({ path: 'new.ts', status: 'added', staged: true });
    });

    it('should handle multiple file statuses in a single result', async () => {
      mockGit.status.mockResolvedValue({
        created: ['new.ts'],
        staged: ['new.ts'],
        modified: ['changed.ts'],
        deleted: ['removed.ts'],
        not_added: ['untracked.txt'],
        renamed: [{ from: 'a.ts', to: 'b.ts' }],
        conflicted: [],
        files: [],
      });
      const result = await service.getStatus();
      expect(result).toHaveLength(5);
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.status.mockRejectedValue(new Error('git status failed'));
      await expect(service.getStatus()).rejects.toThrow(
        'Failed to get git status: git status failed'
      );
    });
  });

  describe('stage', () => {
    it('should call git.add with the paths', async () => {
      mockGit.add.mockResolvedValue(undefined);
      await service.stage(['file1.ts', 'file2.ts']);
      expect(mockGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.add.mockRejectedValue(new Error('add failed'));
      await expect(service.stage(['bad.ts'])).rejects.toThrow('Failed to stage files: add failed');
    });
  });

  describe('unstage', () => {
    it('should call git.reset with correct args', async () => {
      mockGit.reset.mockResolvedValue(undefined);
      await service.unstage(['file1.ts', 'file2.ts']);
      expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', '--', 'file1.ts', 'file2.ts']);
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.reset.mockRejectedValue(new Error('reset failed'));
      await expect(service.unstage(['bad.ts'])).rejects.toThrow(
        'Failed to unstage files: reset failed'
      );
    });
  });

  describe('commit', () => {
    it('should return the commit SHA', async () => {
      mockGit.commit.mockResolvedValue({
        commit: 'abc123def',
        author: null,
        branch: 'main',
        root: false,
        summary: { changes: 1, insertions: 5, deletions: 0 },
      });
      const sha = await service.commit('feat: add feature');
      expect(sha).toBe('abc123def');
      expect(mockGit.commit).toHaveBeenCalledWith('feat: add feature');
    });

    it('should wrap errors with meaningful message', async () => {
      mockGit.commit.mockRejectedValue(new Error('nothing to commit'));
      await expect(service.commit('empty')).rejects.toThrow('Failed to commit: nothing to commit');
    });
  });

  describe('setBaseDir', () => {
    it('should reinitialize simple-git with new directory', async () => {
      const simpleGit = await import('simple-git');
      const simpleGitFn = vi.mocked(simpleGit.default);

      // Clear the constructor call from beforeEach
      simpleGitFn.mockClear();

      service.setBaseDir('/new/repo/path');

      expect(simpleGitFn).toHaveBeenCalledWith({ baseDir: '/new/repo/path' });
    });
  });
});
