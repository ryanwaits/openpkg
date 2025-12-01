import { Button } from '@doccov/ui/button';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button>New Project</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Total Projects</div>
          <div className="text-3xl font-bold">0</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Avg Coverage</div>
          <div className="text-3xl font-bold">--%</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Drift Issues</div>
          <div className="text-3xl font-bold">0</div>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
        <p className="text-muted-foreground">No projects yet. Create your first project to get started.</p>
      </div>
    </div>
  );
}
