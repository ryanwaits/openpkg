# Annotations

Code annotations allow you to highlight, mark, diff, collapse, and add interactive elements to code blocks.

Annotations are added as comments in your code using the `// !annotation` syntax.

## Available Annotations

| Annotation | Description |
|------------|-------------|
| `!mark` | Highlight a line |
| `!diff +/-` | Show added/removed lines |
| `!collapse` | Collapse a range of lines |
| `!expandable` | Make remaining code expandable |
| `!link` | Add clickable links to code |
| `!callout` | Add callout annotations |
| `!hover` | Add hover highlights |
| `!tooltip` | Add tooltips to code |

## Mark

Highlight specific lines:

```typescript
function fetchUser(id: string) {
  // !mark
  const response = await fetch(`/api/users/${id}`);
  const user = await response.json(); // !mark
  return user;
}
```

- `// !mark` on its own line highlights the next line
- `// !mark` at end of line highlights that line

## Diff

Show code changes with added/removed lines:

```typescript
function greet(name: string) {
  // !diff -
  return "Hello, " + name;
  // !diff +
  return `Hello, ${name}!`;
}
```

- `// !diff -` marks the next line as removed (red background)
- `// !diff +` marks the next line as added (green background)

## Collapse

Collapse a range of lines (expandable on click):

```typescript
function createUser(data: UserData) {
  // !collapse(1:4)
  const validated = validateInput(data);
  const normalized = normalizeData(validated);
  const encrypted = encryptSensitive(normalized);
  const user = await db.users.create(encrypted);
  return user;
}
```

- `// !collapse(start:count)` collapses `count` lines starting from line `start` (relative)
- `// !collapse(1:4) collapsed` starts in collapsed state

### Initially Collapsed

```typescript
class ApiClient {
  // !collapse(1:5) collapsed
  private baseUrl: string;
  private headers: Headers;
  private timeout: number;
  private retryCount: number;
  private cache: Map<string, any>;

  async fetch(endpoint: string) {
    return fetch(this.baseUrl + endpoint);
  }
}
```

## Expandable

Make everything after the annotation expandable:

```typescript
async function getUsers() {
  const { data } = await supabase.from('users').select('*');
  return data;
}
// !expandable
async function getUserById(id: string) {
  // This and everything below is hidden by default
  const { data } = await supabase.from('users').select('*').eq('id', id);
  return data;
}
```

Shows a "Show more" button to reveal the rest.

## Link

Add clickable links to code:

```typescript
// !link[/useState/] https://react.dev/reference/react/useState
import { useState } from 'react';

function Counter() {
  // !link[/useState/] https://react.dev/reference/react/useState
  const [count, setCount] = useState(0);
  return <button>{count}</button>;
}
```

Syntax: `// !link[/pattern/] url`

- Pattern is a regex to match text
- Matched text becomes a clickable link

## Callout

Add inline callout annotations:

```typescript
function fetchData(url: string) {
  // !callout[/fetch/] Makes an HTTP request
  return fetch(url)
    .then(res => res.json());
}
```

Syntax: `// !callout[/pattern/] message`

Shows an annotation badge next to the matched text.

## Hover

Highlight code when hovering external elements:

```tsx
<WithHover>
  <p>
    Is <HoverLink href="hover:item">pink</HoverLink> in the list?
  </p>
  <DocsKitCode
    codeblock={{
      value: `# !hover[/pink/gm] item
L = ['red', 'pink', 'blue']
if 'pink' in L:
    print('yes')`,
      lang: 'python',
      meta: '',
    }}
  />
</WithHover>
```

Syntax: `# !hover[/pattern/flags] name`

- Requires wrapping in `<WithHover>` component
- Use `<HoverLink href="hover:name">` to create hover triggers

## Tooltip

Add tooltips to code:

```typescript
function calculate(a: number, b: number) {
  // !tooltip[/sum/] The sum of two numbers
  const sum = a + b;
  // !tooltip[/product/] The product of two numbers
  const product = a * b;
  return { sum, product };
}
```

Syntax: `// !tooltip[/pattern/] tooltip text`

Shows a tooltip when hovering the matched text.

## Combining Annotations

You can use multiple annotations in the same code block:

```typescript
function processData(input: Data) {
  // !mark
  const validated = validate(input);  // !tooltip[/validate/] Checks data integrity

  // !collapse(1:3)
  const step1 = transform(validated);
  const step2 = normalize(step1);
  const step3 = optimize(step2);

  // !diff -
  return step3;
  // !diff +
  return { data: step3, timestamp: Date.now() };
}
```

## See Also

- [Code Blocks](./code-blocks.md) - Basic code block usage
- [Code Tabs](./code-tabs.md) - Multi-file examples
