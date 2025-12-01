import { Button } from '@doccov/ui/button';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-24">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight">
          Documentation Coverage for TypeScript
        </h1>
        <p className="text-xl text-muted-foreground">
          Track, measure, and improve your TypeScript documentation. Catch drift between your docs
          and code before it reaches production.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="secondary">
            Learn More
          </Button>
        </div>
      </div>
    </div>
  );
}
