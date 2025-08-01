# Unified CLI Authentication Design

## Overview

OpenPkg CLI will be a single tool that includes both open-source and Studio features. Studio features require authentication.

## CLI Commands

### Open Source (Free)
```bash
openpkg generate              # Generate spec from local files
openpkg generate src/index.ts # Specify entry point
openpkg init                  # Initialize OpenPkg in project
```

### Studio Features (Requires Auth)
```bash
openpkg analyze <url>         # Analyze from any URL
openpkg playground            # Launch interactive playground  
openpkg lint                  # Advanced linting
openpkg improve               # AI-powered improvements
```

## Authentication Flow

### 1. Login Command
```bash
$ openpkg login

Welcome to OpenPkg Studio!

? How would you like to authenticate? (Use arrow keys)
❯ Login with GitHub
  Login with email
  Enter API key

✓ Opening browser for authentication...
✓ Successfully logged in as @username
✓ Subscription: OpenPkg Studio Pro

Your auth token has been saved to ~/.openpkg/auth.json
```

### 2. Check Auth on Studio Commands
```typescript
// In CLI command handler
async function requireAuth(): Promise<AuthContext> {
  const auth = await loadAuthToken();
  
  if (!auth) {
    console.log(chalk.yellow('This feature requires OpenPkg Studio.'));
    console.log('\nOpenPkg Studio includes:');
    console.log('  • Analyze code from any URL');
    console.log('  • AI-powered type inference');
    console.log('  • Interactive playground');
    console.log('  • Advanced linting\n');
    
    const shouldLogin = await confirm({
      message: 'Would you like to login?',
      default: true
    });
    
    if (shouldLogin) {
      return await login();
    } else {
      console.log(chalk.gray('Run "openpkg login" when ready.'));
      process.exit(0);
    }
  }
  
  // Validate token
  const isValid = await validateToken(auth.token);
  if (!isValid) {
    console.log(chalk.red('Your session has expired.'));
    return await login();
  }
  
  return auth;
}
```

### 3. Auth Storage
```typescript
// ~/.openpkg/auth.json
{
  "token": "opk_live_...",
  "userId": "user_123",
  "email": "user@example.com",
  "subscription": {
    "plan": "pro",
    "creditsRemaining": 9500,
    "resetDate": "2024-02-01"
  },
  "expiresAt": "2024-01-15T00:00:00Z"
}
```

## Implementation in Open Source

### 1. Add Auth Module
```typescript
// src/cli/auth/index.ts
export async function checkAuth(): Promise<boolean> {
  try {
    const authPath = path.join(os.homedir(), '.openpkg', 'auth.json');
    if (!fs.existsSync(authPath)) return false;
    
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    return new Date(auth.expiresAt) > new Date();
  } catch {
    return false;
  }
}

export async function getAuthToken(): Promise<string | null> {
  const authPath = path.join(os.homedir(), '.openpkg', 'auth.json');
  if (!fs.existsSync(authPath)) return null;
  
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
  return auth.token;
}
```

### 2. Modify CLI Commands
```typescript
// src/cli.ts
program
  .command('analyze [source]')
  .description('Analyze TypeScript from any source (OpenPkg Studio)')
  .option('-o, --output <file>', 'Output file', 'openpkg.json')
  .action(async (source, options) => {
    // Check auth first
    if (!await checkAuth()) {
      console.log(chalk.yellow('⚡ This is an OpenPkg Studio feature\n'));
      console.log('Studio features include:');
      console.log('  • Analyze code from URLs');
      console.log('  • AI-powered type inference');
      console.log('  • No setup required\n');
      
      console.log('Get started at: https://openpkg.dev/studio');
      console.log('Run "openpkg login" after signing up\n');
      return;
    }
    
    // Make API call to Studio backend
    const token = await getAuthToken();
    const result = await analyzeWithStudio(source, token, options);
    
    // Handle result...
  });
```

### 3. Studio API Client
```typescript
// src/studio/client.ts
const STUDIO_API = process.env.OPENPKG_STUDIO_API || 'https://api.openpkg.dev';

export async function analyzeWithStudio(
  source: string,
  token: string,
  options: AnalyzeOptions
): Promise<OpenPkgSpec> {
  const response = await fetch(`${STUDIO_API}/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ source, options })
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Upgrade your plan for more analyses.');
    }
    throw new Error(`Analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

## Benefits

1. **Single Tool**: Users only install one CLI
2. **Clear Upgrade Path**: See what Studio offers when using free features
3. **Graceful Degradation**: Free features always work
4. **Marketing**: Every CLI user sees Studio features