# Scalar for SvelteKit

A SvelteKit integration for the API Reference

![Screenshot of the SvelteKit integration](../assets/screenshots/sveltekit.png)

## Installation

```bash
npm install @scalar/sveltekit
```

## Usage

```typescript
// routes/+server.ts
import { ScalarApiReference } from '@scalar/sveltekit'
import type { RequestHandler } from './$types'

const render = ScalarApiReference({
  url: 'https://registry.scalar.com/@scalar/apis/galaxy?format=json',
})

export const GET: RequestHandler = () => {
  return render()
}
```

## AsyncAPI

AsyncAPI documents work the same way — point `url` at one and the reference auto-detects the type. Add `documentType: 'asyncapi'` on a source to be explicit:

```typescript
const render = ScalarApiReference({
  sources: [
    { title: 'Streaming API', url: '/asyncapi.json', documentType: 'asyncapi' },
  ],
})
```

See the [AsyncAPI documentation](../asyncapi.md) for more.
