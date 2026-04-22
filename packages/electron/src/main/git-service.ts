import simpleGit, { type SimpleGit } from 'simple-git';
import type { GitAdapter, GitFileStatus } from '@mdreview/core';

/**
 * Electron-side implementation of GitAdapter using simple-git.
 * Wraps the simple-git library to provide git operations for the
 * currently opened folder/repository.
 */
export class ElectronGitService implements GitAdapter {
  private git: SimpleGit;

  constructor(baseDir: string) {
    this.git = simpleGit({ baseDir });
  }

  /**
   * Reinitialize simple-git with a new base directory.
   * Called when the user opens a different folder.
   */
  setBaseDir(dir: string): void {
    this.git = simpleGit({ baseDir: dir });
  }

  async isGitRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch (error) {
      throw new Error(
        `Failed to check if directory is a git repo: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const result = await this.git.branchLocal();
      return result.current;
    } catch (error) {
      throw new Error(
        `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async listBranches(): Promise<{ local: string[]; current: string }> {
    try {
      const result = await this.git.branchLocal();
      return {
        local: result.all,
        current: result.current,
      };
    } catch (error) {
      throw new Error(
        `Failed to list branches: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async checkout(branch: string): Promise<void> {
    try {
      await this.git.checkout(branch);
    } catch (error) {
      throw new Error(
        `Failed to checkout branch "${branch}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getStatus(): Promise<GitFileStatus[]> {
    try {
      const status = await this.git.status();
      const files: GitFileStatus[] = [];

      // staged created files
      for (const filePath of status.created) {
        files.push({ path: filePath, status: 'added', staged: true });
      }

      // staged modified files
      for (const filePath of status.staged) {
        // Avoid duplicates — staged array includes all staged files, but we
        // handle created/deleted/renamed separately
        if (
          status.created.includes(filePath) ||
          status.deleted.includes(filePath) ||
          status.renamed.some((r) => r.to === filePath)
        ) {
          continue;
        }
        files.push({ path: filePath, status: 'modified', staged: true });
      }

      // working-tree modified files (unstaged)
      for (const filePath of status.modified) {
        files.push({ path: filePath, status: 'modified', staged: false });
      }

      // deleted files
      for (const filePath of status.deleted) {
        files.push({ path: filePath, status: 'deleted', staged: false });
      }

      // untracked files
      for (const filePath of status.not_added) {
        files.push({ path: filePath, status: 'untracked', staged: false });
      }

      // renamed files
      for (const renamed of status.renamed) {
        files.push({ path: renamed.to, status: 'renamed', staged: true });
      }

      // conflicted files — report as modified
      for (const filePath of status.conflicted) {
        files.push({ path: filePath, status: 'modified', staged: false });
      }

      return files;
    } catch (error) {
      throw new Error(
        `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stage(paths: string[]): Promise<void> {
    try {
      await this.git.add(paths);
    } catch (error) {
      throw new Error(
        `Failed to stage files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async unstage(paths: string[]): Promise<void> {
    try {
      await this.git.reset(['HEAD', '--', ...paths]);
    } catch (error) {
      throw new Error(
        `Failed to unstage files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async commit(message: string): Promise<string> {
    try {
      const result = await this.git.commit(message);
      return result.commit;
    } catch (error) {
      throw new Error(
        `Failed to commit: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stash(): Promise<void> {
    try {
      await this.git.stash();
    } catch (error) {
      throw new Error(
        `Failed to stash changes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
