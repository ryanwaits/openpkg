'use client';

import { Button } from '@doccov/ui/button';
import { Input } from '@doccov/ui/input';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function BadgeGenerator() {
  const [repoUrl, setRepoUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [badgeMarkdown, setBadgeMarkdown] = useState('');

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    // Handle various GitHub URL formats
    const patterns = [/github\.com\/([^/]+)\/([^/.\s]+)/, /^([^/]+)\/([^/.\s]+)$/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }
    return null;
  };

  const handleGenerate = () => {
    const parsed = parseGitHubUrl(repoUrl);
    if (parsed) {
      const markdown = `[![DocCov](https://doccov.dev/badge/${parsed.owner}/${parsed.repo})](https://doccov.dev/${parsed.owner}/${parsed.repo})`;
      setBadgeMarkdown(markdown);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(badgeMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGenerate();
    }
  };

  const parsed = parseGitHubUrl(repoUrl);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="github.com/owner/repo or owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleGenerate} disabled={!parsed}>
          Generate
        </Button>
      </div>

      {badgeMarkdown && (
        <div className="space-y-3">
          {/* Preview */}
          <div className="flex justify-center p-4 bg-muted rounded-lg">
            {/* biome-ignore lint/performance/noImgElement: external badge URL can't use next/image */}
            <img
              src={`https://doccov.dev/badge/${parsed?.owner}/${parsed?.repo}`}
              alt="DocCov badge preview"
            />
          </div>

          {/* Markdown */}
          <div className="relative">
            <div className="bg-muted rounded-lg p-3 pr-12 font-mono text-sm overflow-x-auto">
              <code className="text-muted-foreground">{badgeMarkdown}</code>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-2 top-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
