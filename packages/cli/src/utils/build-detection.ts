import * as fs from "fs";
import * as path from "path";

export interface BuildStatus {
  hasNodeModules: boolean;
  hasDistFolder: boolean;
  hasWorkspaces: boolean;
  hasUnresolvedWorkspaceImports: boolean;
  isMonorepo: boolean;
  hasBuildScript: boolean;
  suggestions: string[];
}

export function detectBuildStatus(targetDir: string): BuildStatus {
  const packageJsonPath = path.join(targetDir, "package.json");
  const nodeModulesPath = path.join(targetDir, "node_modules");
  const distPath = path.join(targetDir, "dist");
  const libPath = path.join(targetDir, "lib");

  const status: BuildStatus = {
    hasNodeModules: fs.existsSync(nodeModulesPath),
    hasDistFolder: fs.existsSync(distPath) || fs.existsSync(libPath),
    hasWorkspaces: false,
    hasUnresolvedWorkspaceImports: false,
    isMonorepo: false,
    hasBuildScript: false,
    suggestions: [],
  };

  // Check package.json for clues
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    // Check for build script
    status.hasBuildScript = !!packageJson.scripts?.build;

    // Check for workspaces (monorepo)
    status.hasWorkspaces = !!packageJson.workspaces;

    // Check if this is inside a monorepo
    const parentPackageJson = path.join(targetDir, "..", "..", "package.json");
    if (fs.existsSync(parentPackageJson)) {
      const parentPkg = JSON.parse(fs.readFileSync(parentPackageJson, "utf-8"));
      status.isMonorepo = !!parentPkg.workspaces;
    }

    // Check for workspace protocol in dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps || {})) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        status.hasUnresolvedWorkspaceImports = true;
        break;
      }
    }
  }

  // Generate suggestions based on status
  if (!status.hasNodeModules) {
    status.suggestions.push(
      "Run `npm install` (or yarn/pnpm/bun install) to install dependencies",
    );
  }

  if (status.isMonorepo && !status.hasDistFolder) {
    status.suggestions.push(
      "Run `npm run build` at the monorepo root to build all packages",
    );
  } else if (status.hasBuildScript && !status.hasDistFolder) {
    status.suggestions.push(
      "Run `npm run build` to compile TypeScript and generate type declarations",
    );
  }

  if (status.hasUnresolvedWorkspaceImports) {
    status.suggestions.push(
      "This package uses workspace dependencies that need to be built first",
    );
  }

  return status;
}

export function shouldWarnAboutBuild(status: BuildStatus): boolean {
  return (
    !status.hasNodeModules ||
    (status.hasBuildScript && !status.hasDistFolder) ||
    status.hasUnresolvedWorkspaceImports ||
    (status.isMonorepo && !status.hasDistFolder)
  );
}

export function formatBuildWarning(status: BuildStatus): string {
  const lines = ["\n⚠️  Build recommended for complete type extraction\n"];

  if (status.suggestions.length > 0) {
    lines.push("Suggestions:");
    status.suggestions.forEach((suggestion) => {
      lines.push(`  • ${suggestion}`);
    });
    lines.push("");
  }

  lines.push("This ensures all dependencies and types can be resolved.");
  lines.push("Some type information may be incomplete without building.\n");

  return lines.join("\n");
}
