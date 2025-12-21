'use client';

import { type CodeFix, type DriftIssue, FixWorkflow } from '@doccov/ui/fix-workflow';

// Demo data - in production this would come from the API
const demoIssues: DriftIssue[] = [
  {
    id: '1',
    type: 'return-type-mismatch',
    priority: 'high',
    filePath: 'src/api.ts',
    line: 45,
    functionName: 'fetchUser',
    description: 'The @returns tag says {User} but the function actually returns Promise<User>.',
    suggestion: 'Update the @returns tag to include the Promise wrapper.',
  },
  {
    id: '2',
    type: 'example-runtime-error',
    priority: 'high',
    filePath: 'src/client.ts',
    line: 12,
    functionName: 'createClient',
    description:
      'The example code throws a TypeError when executed. The config parameter is missing required fields.',
    suggestion: 'Update the example to include all required configuration options.',
  },
  {
    id: '3',
    type: 'param-mismatch',
    priority: 'medium',
    filePath: 'src/client.ts',
    line: 42,
    functionName: 'getUser',
    description:
      'The parameter @param userId is documented but the actual function signature has id.',
    suggestion: 'Rename the @param tag to match the actual parameter name id.',
  },
  {
    id: '4',
    type: 'param-mismatch',
    priority: 'medium',
    filePath: 'src/utils/format.ts',
    line: 18,
    functionName: 'formatDate',
    description:
      'The parameter @param dateString is documented but the function expects a Date object.',
    suggestion: 'Update the @param tag to reflect the correct parameter type.',
  },
  {
    id: '5',
    type: 'optionality-mismatch',
    priority: 'medium',
    filePath: 'src/config.ts',
    line: 87,
    functionName: 'createConfig',
    description:
      'The parameter @param options is documented as required but is actually optional in the signature.',
    suggestion: 'Add a ? to the @param tag or note that the parameter is optional.',
  },
  {
    id: '6',
    type: 'deprecated-mismatch',
    priority: 'medium',
    filePath: 'src/legacy.ts',
    line: 23,
    functionName: 'oldMethod',
    description:
      'The function is marked @deprecated in code but the documentation does not mention deprecation.',
    suggestion: 'Add a deprecation notice to the documentation.',
  },
  {
    id: '7',
    type: 'visibility-mismatch',
    priority: 'low',
    filePath: 'src/internal.ts',
    line: 156,
    functionName: '_internalHelper',
    description: 'The function is marked @internal but is exported from the public API.',
    suggestion: 'Either remove the @internal tag or stop exporting this function.',
  },
  {
    id: '8',
    type: 'broken-link',
    priority: 'low',
    filePath: 'src/client.ts',
    line: 8,
    description: 'The documentation links to https://example.com/old-docs which returns a 404.',
    suggestion: 'Update the link to point to the correct documentation URL.',
  },
];

const demoFixes: Record<string, CodeFix> = {
  '1': {
    issueId: '1',
    language: 'typescript',
    before: `/**
 * Fetches a user by their ID from the API.
 * @param id - The unique user identifier
 * @returns {User} The user object
 */
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`,
    after: `/**
 * Fetches a user by their ID from the API.
 * @param id - The unique user identifier
 * @returns {Promise<User>} The user object
 */
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`,
  },
  '2': {
    issueId: '2',
    language: 'typescript',
    before: `/**
 * Creates a new API client instance.
 * @param config - Client configuration
 * @example
 * const client = createClient({});
 * client.get('/users');
 */
export function createClient(config: ClientConfig): Client {
  if (!config.baseUrl) throw new TypeError('baseUrl is required');
  return new Client(config);
}`,
    after: `/**
 * Creates a new API client instance.
 * @param config - Client configuration
 * @example
 * const client = createClient({ baseUrl: 'https://api.example.com' });
 * client.get('/users');
 */
export function createClient(config: ClientConfig): Client {
  if (!config.baseUrl) throw new TypeError('baseUrl is required');
  return new Client(config);
}`,
  },
  '3': {
    issueId: '3',
    language: 'typescript',
    before: `/**
 * Gets a user by their unique identifier.
 * @param userId - The unique user ID
 * @returns The user object if found
 */
export function getUser(id: string): User | null {
  return users.find(u => u.id === id) ?? null;
}`,
    after: `/**
 * Gets a user by their unique identifier.
 * @param id - The unique user ID
 * @returns The user object if found
 */
export function getUser(id: string): User | null {
  return users.find(u => u.id === id) ?? null;
}`,
  },
  '4': {
    issueId: '4',
    language: 'typescript',
    before: `/**
 * Formats a date for display.
 * @param dateString - The date string to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US');
}`,
    after: `/**
 * Formats a date for display.
 * @param date - The Date object to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US');
}`,
  },
  '5': {
    issueId: '5',
    language: 'typescript',
    before: `/**
 * Creates a configuration object.
 * @param options - Configuration options
 * @returns The final configuration
 */
export function createConfig(options?: ConfigOptions): Config {
  return { ...defaultConfig, ...options };
}`,
    after: `/**
 * Creates a configuration object.
 * @param options - Configuration options (optional)
 * @returns The final configuration
 */
export function createConfig(options?: ConfigOptions): Config {
  return { ...defaultConfig, ...options };
}`,
  },
  '6': {
    issueId: '6',
    language: 'typescript',
    before: `/**
 * Processes data using the old algorithm.
 * @param data - Data to process
 */
/** @deprecated Use newMethod instead */
export function oldMethod(data: Data): void {
  // legacy implementation
}`,
    after: `/**
 * Processes data using the old algorithm.
 * @param data - Data to process
 * @deprecated Use newMethod instead
 */
export function oldMethod(data: Data): void {
  // legacy implementation
}`,
  },
  '7': {
    issueId: '7',
    language: 'typescript',
    before: `/**
 * Internal helper function.
 * @internal
 */
export function _internalHelper(): void {
  // implementation
}`,
    after: `/**
 * Internal helper function.
 * Not part of the public API - may change without notice.
 */
function _internalHelper(): void {
  // implementation
}`,
  },
  '8': {
    issueId: '8',
    language: 'typescript',
    before: `/**
 * API Client for making HTTP requests.
 * @see https://example.com/old-docs
 */
export class Client {
  // implementation
}`,
    after: `/**
 * API Client for making HTTP requests.
 * @see https://docs.example.com/api-client
 */
export class Client {
  // implementation
}`,
  },
};

export default function FixPage() {
  const handleCreatePR = async (acceptedFixes: Array<{ issueId: string; fix: string }>) => {
    // In production, this would call the API to create a PR
    console.log('Creating PR with fixes:', acceptedFixes);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    alert(`PR created with ${acceptedFixes.length} fix${acceptedFixes.length !== 1 ? 'es' : ''}!`);
  };

  return (
    <div className="h-[calc(100vh-64px)]">
      <FixWorkflow
        issues={demoIssues}
        fixes={demoFixes}
        projectName="zod-openapi"
        onCreatePR={handleCreatePR}
      />
    </div>
  );
}
