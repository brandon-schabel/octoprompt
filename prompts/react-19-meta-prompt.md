### React 19 Meta Prompt

> **Role**: You are a highly skilled software engineer upgrading an existing React application to React 19. You want to:
>
> - Adopt **new concurrency features** like async transitions and Actions.
> - Leverage **new hooks** such as `useActionState`, `useOptimistic`, `useFormStatus`, and `use`.
> - Explore **new DOM APIs** for static site generation, resource preloading, and script handling.
> - Migrate away from **deprecated patterns** (e.g., `forwardRef`) toward simpler usage of `ref` as a prop.
> - Optimize your application’s performance, rendering flows, and user experience.
> - Write **modern TypeScript** code using best practices.

> **Task**: Summarize each new React 19 feature (Actions, new hooks like `useActionState`, `useOptimistic`, etc.), provide clear, up-to-date TypeScript examples, and demonstrate real-world usage scenarios where they prevent bugs or streamline the developer experience. Be concise, highlight potential pitfalls, and show how these features integrate seamlessly with existing patterns.

> **Key Points & Examples**:
>
> - **Actions** and `useActionState` for handling async transitions, form submissions, errors, and optimistic updates.
> - **`<form>` Actions** and `useFormStatus` to automatically manage form submissions, resetting, and pending states.
> - **`useOptimistic`** for immediate UI updates while waiting for async requests.
> - **`use`** API for Suspense-friendly data fetching and conditional Context consumption.
> - **React DOM Static APIs** (`prerender`, `prerenderToNodeStream`) for static site generation and Node/Web streaming.
> - **Server Components** and **Server Actions** for separating data operations onto the server.
> - **New ref cleanup** pattern, `<Context>` as a provider, improved hydration error diffs, and simpler `ref` usage without `forwardRef`.
> - **Resource Preloading** (`preload`, `preinit`, etc.) and built-in `<link>`, `<script>`, `<meta>`, `<style>` management for concurrency-friendly resource loading.

> **Output**: For each feature, produce (1) a short description explaining its purpose; (2) a concise TypeScript code snippet (or multiple, if needed) that shows how to use it; (3) a one-liner about why it helps avoid bugs or improves developer experience.

---

## Example Usage Scenarios

Below are examples of how you might answer each section of the meta prompt.

### 1. Actions and `useActionState`

```tsx
// Example: Using Actions to handle form submission with automatic pending state and error handling

import React, { useActionState } from 'react';
import { redirect } from './some-router';

async function updateName(name: string): Promise<string | null> {
  // Returns an error string if there's a problem, otherwise null on success
  // ...
  return null;
}

export function ChangeName() {
  const [error, submitAction, isPending] = useActionState(
    async (prevError, formData) => {
      const name = formData.get('name') as string;
      const error = await updateName(name);
      if (error) return error;
      redirect('/success');
      return null;
    },
    null
  );

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button type="submit" disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

**Why It Helps**: Removes boilerplate around managing pending states, errors, and redirection. Reduces potential race condition bugs by abstracting away manual state management.

---

### 2. `<form>` Actions and `useFormStatus`

```tsx
// Example: Custom submit button that needs form's pending status

import React from 'react';
import { useFormStatus } from 'react-dom';

export function CustomSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      Submit
    </button>
  );
}
```

**Why It Helps**: Eliminates prop drilling for form states. Makes building design system components with built-in knowledge of form submission states much simpler.

---

### 3. `useOptimistic`

```tsx
// Example: Live preview of user name changes while request is in flight

import React, { useOptimistic } from 'react';

export function ChangeName({ currentName, onNameSaved }: {
  currentName: string;
  onNameSaved: (newName: string) => void;
}) {
  const [optimisticName, setOptimisticName] = useOptimistic(currentName);

  async function submitAction(formData: FormData) {
    const newName = formData.get('name') as string;
    setOptimisticName(newName);
    // Assume updateName is an async function
    const finalName = await updateName(newName);
    onNameSaved(finalName);
  }

  return (
    <form action={submitAction}>
      <p>Current (optimistic) name: {optimisticName}</p>
      <input type="text" name="name" defaultValue={currentName} />
      <button type="submit">Save</button>
    </form>
  );
}
```

**Why It Helps**: Provides instant feedback for improved UX. Avoids stale UI bugs by automatically reverting to the real data if a request fails.

---

### 4. `use`

```tsx
// Example: Suspense reading a promise or context conditionally

import React, { Suspense, use } from 'react';

interface Comment {
  id: number;
  text: string;
}

export function Comments({ commentsPromise }: {
  commentsPromise: Promise<Comment[]>;
}) {
  const comments = use(commentsPromise);
  return (
    <>
      {comments.map(comment => (
        <p key={comment.id}>{comment.text}</p>
      ))}
    </>
  );
}

export function CommentsWrapper({ commentsPromise }: {
  commentsPromise: Promise<Comment[]>;
}) {
  return (
    <Suspense fallback={<div>Loading Comments...</div>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

**Why It Helps**: Suspense-based data reading streamlines async fetching, reducing potential state mismanagement or race conditions in component trees.

---

### 5. New React DOM Static APIs

```tsx
// Example: Using prerender to wait for data before streaming static HTML

import { prerender } from 'react-dom/static';
import App from './App';

async function handleRequest() {
  const { prelude } = await prerender(<App />, {
    bootstrapScripts: ['/main.js'],
  });

  return new Response(prelude, {
    headers: { 'content-type': 'text/html' },
  });
}
```

**Why It Helps**: Ensures data is ready for static site generation. Eliminates flicker of content that depends on asynchronous data.

---

### 6. Ref as a Prop (No More `forwardRef`)

```tsx
// Example: Function component accepting `ref` directly

import React, { useRef } from 'react';

function MyInput({ placeholder, ref }: {
  placeholder?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return <input placeholder={placeholder} ref={ref} />;
}

// Usage
export function Parent() {
  const inputRef = useRef<HTMLInputElement>(null);

  return <MyInput ref={inputRef} placeholder="Type here..." />;
}
```

**Why It Helps**: Simplifies passing refs; avoids boilerplate `forwardRef`. Fewer ref-related bugs and more straightforward code.

---

### 7. Document Metadata and Style/Script Handling

```tsx
// Example: Inline metadata tags hoisted to <head>

export function BlogPost({ title, content }: { title: string; content: string }) {
  return (
    <article>
      <h1>{title}</h1>
      <title>{title}</title>
      <meta name="description" content="Meta description example" />
      <link rel="stylesheet" href="/post-styles.css" precedence="default" />
      <p>{content}</p>
    </article>
  );
}

// Example: Async script usage
function ExternalWidget() {
  return (
    <div>
      <script async src="https://example.com/widget.js"></script>
      <p>External widget will load here.</p>
    </div>
  );
}
```

**Why It Helps**: Automatically moves `<title>`, `<meta>`, `<link>`, and `<script>` to the appropriate section in the HTML. Prevents race conditions with script loading and improves SSR.

---

### 8. Resource Preloading APIs

```tsx
// Example: preloading resources for faster navigation

import React from 'react';
import { preinit, preload } from 'react-dom';

export function MyComponent() {
  // Preinit a script for immediate load/exec
  preinit('https://cdn.example.com/fast-lib.js', { as: 'script' });
  // Preload a stylesheet
  preload('https://cdn.example.com/fast-styles.css', { as: 'style' });

  return <div>Loaded with preinit/preload!</div>;
}
```

**Why It Helps**: Informs the browser about critical resources at the earliest moment, reducing loading times and avoiding flickers or layout shifts.

---

### 9. Better Error Reporting and Hydration

```tsx
// Example: onCaughtError and onUncaughtError usage

import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement, {
  onCaughtError: (error) => {
    console.warn('Caught an error in boundary:', error);
  },
  onUncaughtError: (error) => {
    console.error('Unhandled error:', error);
    // Possibly send to monitoring service
  },
  onRecoverableError: (error) => {
    console.debug('Recoverable error:', error);
  }
}).render(<App />);
```

**Why It Helps**: Provides granular hooks for handling different error classes. Reduces confusion by logging each error only once.
