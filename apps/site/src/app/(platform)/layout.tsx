export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-muted/40 p-4">
        <div className="font-bold text-lg mb-8">DocCov</div>
        <nav className="space-y-2">
          <a
            href="/dashboard"
            className="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Dashboard
          </a>
          <a
            href="/dashboard/projects"
            className="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Projects
          </a>
          <a
            href="/dashboard/settings"
            className="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Settings
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
