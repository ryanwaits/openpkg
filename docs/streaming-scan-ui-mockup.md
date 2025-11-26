Frontend Integration (example)
const startScan = async (url: string, pkg?: string) => {
  // Start job
  const { jobId } = await fetch('/scan', {
    method: 'POST',
    body: JSON.stringify({ url, package: pkg })
  }).then(r => r.json());

  // Connect to SSE stream
  const events = new EventSource(`/scan/${jobId}/stream`);
  
  events.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'progress') {
      setStage(data.stage);
      setMessage(data.message);
      setProgress(data.progress);
    } else if (data.type === 'complete') {
      setResult(data.result);
      events.close();
    } else if (data.type === 'error') {
      setError(data.message);
      events.close();
    }
  };
};
Stages Mapping
| Stage | Sandbox Step | Message Example |

|-------|--------------|-----------------|

| cloning | Sandbox.create() | "Cloning stx-labs/stacks.js..." |

| detecting | ls, read package.json | "Detected pnpm monorepo with 12 packages" |

| installing | pnpm/npm install | "Installing dependencies..." |

| building | npm run build | "Building @stacks/transactions..." |

| analyzing | doccov generate | "Generating DocCov spec..." |

| extracting | node summary script | "Analyzing 410 exports..." |

| complete | Final result | "Documentation coverage: 32%" |



UI Mockup Flow
┌─ Step 1: Enter URL ─────────────────────────────┐
│  [https://github.com/stx-labs/stacks.js    ] 🔍 │
│  [ Continue ]                                   │
└─────────────────────────────────────────────────┘
        │
        ▼ (detect monorepo)
┌─ Step 2: Select Package ────────────────────────┐
│  📦 Monorepo with 12 packages                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ ● @stacks/transactions                  │   │
│  │ ○ @stacks/network                       │   │
│  │ ○ @stacks/common                        │   │
│  │ ○ @stacks/wallet-sdk                    │   │
│  └─────────────────────────────────────────┘   │
│  [ Analyze Documentation ]                      │
└─────────────────────────────────────────────────┘
        │
        ▼ (SSE stream)
┌─ Step 3: Progress ──────────────────────────────┐
│  ✓ Cloned repository                            │
│  ✓ Detected pnpm monorepo                       │
│  ✓ Installed dependencies                       │
│  ⏳ Building @stacks/transactions...            │
│  ○ Analyzing exports                            │
│                                                 │
│  ████████████░░░░░░░░ 60%                       │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 4: Results ───────────────────────────────┐
│  📊 @stacks/transactions                        │
│                                                 │
│  Coverage: 32%  ████░░░░░░                      │
│                                                 │
│  410 exports · 184 types · 71 drift issues      │
│                                                 │
│  [ View Full Report ] [ Try Another ]           │
└─────────────────────────────────────────────────┘