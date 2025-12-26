import { Button } from '@doccov/ui/button';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle,
  Clock,
  Code2,
  GitPullRequest,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { BadgeGenerator } from '@/components/badge-generator';
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
              <BadgeCheck className="h-4 w-4" />
              The badge is the product
            </div>

            <h1 className="text-5xl font-bold tracking-tight">
              Documentation Coverage for TypeScript
            </h1>
            <p className="text-xl text-muted-foreground">
              Show the world your docs are complete. One badge. One command. Zero config.
            </p>

            {/* CLI snippet */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg font-mono text-sm">
              <span className="text-muted-foreground">$</span>
              <span>npx doccov check</span>
            </div>

            {/* CTAs */}
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="#quick-start">Get Your Badge</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <a
                  href="https://github.com/doccov/doccov"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Problem / Promise / Proof Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Problem */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">The Problem</h3>
            <p className="text-muted-foreground">
              Code coverage badges are everywhere. But your docs? Users have no idea if they&apos;re
              complete, accurate, or even exist.
            </p>
          </div>

          {/* Promise */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">The Promise</h3>
            <p className="text-muted-foreground">
              A badge that proves your docs are documented. Like code coverage, but for JSDoc. Show
              &quot;docs 90%&quot; in your README.
            </p>
          </div>

          {/* Proof */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold">The Proof</h3>
            <p className="text-muted-foreground">
              Works out of the box for 80% of TypeScript repos. Zero config. Auto-detects your entry
              point and tsconfig.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <div id="quick-start" className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Setup in 60 Seconds</h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Initialize DocCov</h3>
                  <div className="bg-background border rounded-lg p-3 font-mono text-sm">
                    <span className="text-muted-foreground">$</span> npx doccov init
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Creates config + GitHub Action in one command
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Run the Check</h3>
                  <div className="bg-background border rounded-lg p-3 font-mono text-sm">
                    <span className="text-muted-foreground">$</span> npx doccov check
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    See your coverage score instantly
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Add the Badge</h3>
                  <p className="text-sm text-muted-foreground">
                    Copy the badge markdown from your terminal output and paste it in your README
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badge Generator Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Generate Your Badge</h2>
          <p className="text-muted-foreground mb-8">
            Enter your GitHub repo URL to get your badge markdown
          </p>
          <BadgeGenerator />
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-background border">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Zero Config</h3>
              <p className="text-sm text-muted-foreground">
                Auto-detects entry points, tsconfig, and applies sensible defaults (80% coverage
                threshold)
              </p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-background border">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">PR Integration</h3>
              <p className="text-sm text-muted-foreground">
                GitHub Action posts coverage delta in PR comments. Block merges when coverage drops.
              </p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-background border">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Drift Detection</h3>
              <p className="text-sm text-muted-foreground">
                Catches when docs and code fall out of sync. Auto-fix with{' '}
                <code className="text-xs bg-muted px-1 rounded">--fix</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Try it Now Section */}
      <TryItNow />
    </div>
  );
}
