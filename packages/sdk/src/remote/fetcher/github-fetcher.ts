export class GitHubFetchError extends Error {
  code: string;
  statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'GitHubFetchError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class GitHubFetcher {
  private static readonly GITHUB_URL_REGEX =
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
  private static readonly TIMEOUT_MS = 5000;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  static isValidGitHubUrl(url: string): boolean {
    return this.GITHUB_URL_REGEX.test(url);
  }

  static toRawUrl(githubUrl: string): string {
    const match = githubUrl.match(this.GITHUB_URL_REGEX);
    if (!match) {
      throw new GitHubFetchError('Invalid GitHub URL format', 'INVALID_URL');
    }

    const [, owner, repo, branch, ...pathParts] = match;
    const path = pathParts.join('/');
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  async fetch(url: string): Promise<string> {
    if (!GitHubFetcher.isValidGitHubUrl(url)) {
      throw new GitHubFetchError(
        'Invalid GitHub URL format. Expected https://github.com/owner/repo/blob/branch/file.ts',
        'INVALID_URL',
      );
    }

    const rawUrl = GitHubFetcher.toRawUrl(url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GitHubFetcher.TIMEOUT_MS);

      const response = await this.fetchImpl(rawUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'openpkg-sdk/remote-analyzer',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new GitHubFetchError('File not found', 'FILE_NOT_FOUND', 404);
        }
        throw new GitHubFetchError(
          `GitHub returned ${response.status}: ${response.statusText}`,
          'FETCH_ERROR',
          response.status,
        );
      }

      return await response.text();
    } catch (error) {
      if (error instanceof GitHubFetchError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new GitHubFetchError('Request timeout after 5 seconds', 'TIMEOUT');
        }
        throw new GitHubFetchError(`Network error: ${error.message}`, 'NETWORK_ERROR');
      }

      throw new GitHubFetchError('Unknown error occurred', 'UNKNOWN_ERROR');
    }
  }
}
