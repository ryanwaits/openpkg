import type { OpenPkg } from '@openpkg-ts/spec';

export async function fetchSpecFromGitHub(
  owner: string,
  repo: string,
  branch = 'main',
): Promise<OpenPkg | null> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/openpkg.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/openpkg.json`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as OpenPkg;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}
