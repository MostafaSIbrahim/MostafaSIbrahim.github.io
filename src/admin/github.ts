/**
 * Minimal typed GitHub REST client for the admin page.
 * Writes go through the Git Data API so one "Publish" = one atomic commit,
 * however many files (JSON + images + videos) it touches.
 */

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface FileChange {
  path: string; // repo path, e.g. public/assets/projects/x/poster-abc.webp
  base64?: string; // new content; omit together with delete: true
  delete?: true;
}

export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

const API = 'https://api.github.com';

/** Branch names may contain "/", which must stay literal in ref paths. */
const refPath = (branch: string): string => branch.split('/').map(encodeURIComponent).join('/');

export class GitHub {
  readonly ref: RepoRef;
  readonly #token: string; // private field: not visible on the object or in logs

  constructor(token: string, ref: RepoRef) {
    this.#token = token;
    this.ref = ref;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API}/repos/${this.ref.owner}/${this.ref.repo}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.#token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!response.ok) {
      let message = response.statusText;
      try {
        message = ((await response.json()) as { message?: string }).message ?? message;
      } catch {
        // body wasn't JSON; keep the status text
      }
      throw new GitHubError(message, response.status);
    }
    return (await response.json()) as T;
  }

  /** Token works, can push, and the branch exists. */
  async verify(): Promise<void> {
    const repo = await this.request<{ permissions?: { push?: boolean } }>('');
    if (!repo.permissions?.push) {
      throw new GitHubError('This token can read the repository but not write to it.', 403);
    }
    await this.request(`/branches/${refPath(this.ref.branch)}`);
  }

  /** Current commit at the tip of the branch. */
  async headSha(): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>(
      `/git/ref/heads/${refPath(this.ref.branch)}`,
    );
    return ref.object.sha;
  }

  async readText(path: string, commitSha: string): Promise<string> {
    const file = await this.request<{ content: string }>(
      `/contents/${path}?ref=${encodeURIComponent(commitSha)}`,
    );
    return base64ToText(file.content);
  }

  /** Every file path under `prefix` at a commit. */
  async listFiles(commitSha: string, prefix: string): Promise<string[]> {
    const commit = await this.request<{ tree: { sha: string } }>(`/git/commits/${commitSha}`);
    const tree = await this.request<{ tree: { path: string; type: string }[] }>(
      `/git/trees/${commit.tree.sha}?recursive=1`,
    );
    return tree.tree
      .filter((e) => e.type === 'blob' && e.path.startsWith(prefix))
      .map((e) => e.path);
  }

  /**
   * Blobs -> tree -> commit -> move the branch. The final step is not forced:
   * if someone else pushed since `parentSha`, GitHub refuses and nothing is overwritten.
   */
  async commit(parentSha: string, changes: FileChange[], message: string): Promise<string> {
    const parent = await this.request<{ tree: { sha: string } }>(`/git/commits/${parentSha}`);
    const tree: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];

    for (const change of changes) {
      if (change.delete) {
        tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await this.request<{ sha: string }>('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: change.base64 ?? '', encoding: 'base64' }),
      });
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const newTree = await this.request<{ sha: string }>('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
    });
    const commit = await this.request<{ sha: string }>('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
    });
    try {
      await this.request(`/git/refs/heads/${refPath(this.ref.branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
    } catch (error) {
      if (error instanceof GitHubError && error.status === 422) {
        throw new GitHubError(
          'The branch changed on GitHub since you loaded it. Reload, re-apply your edits and publish again.',
          409,
        );
      }
      throw error;
    }
    return commit.sha;
  }
}

// ---- base64 helpers (UTF-8 safe) ----

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000; // avoid call-stack limits on large files
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export const textToBase64 = (text: string): string => bytesToBase64(new TextEncoder().encode(text));

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function base64ToText(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
