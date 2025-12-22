import { Button } from '@doccov/ui/button';
import { BarChart3, CheckCircle, GitPullRequest } from 'lucide-react';
import Link from 'next/link';
import { TryItNow } from '@/components/try-it-now';

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
            TypeScript First
          </div>

          <h1 className="text-5xl font-bold tracking-tight">
            Documentation Coverage for TypeScript
          </h1>
          <p className="text-xl text-muted-foreground">
            Track, measure, and improve your TypeScript documentation. Catch drift between your docs
            and code before it reaches production.
          </p>

          {/* CLI snippet */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg font-mono text-sm">
            <span className="text-muted-foreground">$</span>
            <span>npx doccov check</span>
          </div>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/pricing">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href="https://github.com/doccov/doccov" target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>

          {/* Value props */}
          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Coverage tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              <span>PR checks</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Quality rules</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Try it Now Section */}
      <TryItNow />
    </div>
  );
}
