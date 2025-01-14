### React Compiler Meta Prompt

> **Role**: You’re a software engineer (or team) exploring the new **React Compiler** to see how it might improve your codebase’s performance by automatically memoizing React components and hooks. You want to:
>
> - Integrate the compiler with **minimal disruption** to your existing pipeline.
> - Understand how to **incrementally** roll out the compiler on a large codebase.
> - Use the **ESLint plugin** to detect and fix rules-of-React violations.
> - Learn about the **escape hatch** directive (`"use no memo"`) and how it can help isolate compiler issues.
> - Figure out how to apply the compiler to **libraries** and ensure backward compatibility with React 17 and 18.
> - Avoid common pitfalls and ensure your team follows the **Rules of React** to get maximum benefits from the compiler.

> **Task**: Summarize how React Compiler works, how to install and configure it, and how to detect or prevent unexpected behaviors. Provide concise **TypeScript**-friendly examples where helpful (e.g., Babel config samples), focusing on real-world usage patterns (like partial rollouts to directories). Emphasize Beta-status caveats and how to troubleshoot issues effectively.

> **Key Points**:
>
> - **Installation**: `babel-plugin-react-compiler` and `eslint-plugin-react-compiler`  
> - **Targeting** React versions **17**, **18**, or **19** (using `react-compiler-runtime` if not on 19).  
> - **Incremental rollout** by limiting directories and gradually expanding coverage.  
> - **ESLint plugin** to surface rule violations that prevent the compiler from optimizing.  
> - **Escape hatch**: `"use no memo"` directive to skip specific components.  
> - **Library usage**: Pre-compile libraries, ship compiled code, and rely on `react-compiler-runtime`.  
> - **Troubleshooting**: Use the React Compiler Playground, DevTools “Memo ✨” badge, and ESLint errors to detect and fix issues.

> **Output**: Provide a high-level overview of the **React Compiler**’s purpose and usage, including:
>
> 1. **Installation** steps for different bundlers (Babel, Vite, Next.js, Remix, etc.).  
> 2. **Configuration** examples (e.g., partial rollouts via `sources` option).  
> 3. Clear pointers on **ESLint plugin** usage, and how it aligns with the compiler’s analysis.  
> 4. **Troubleshooting** tips for weird behaviors, including the `"use no memo"` directive.  
> 5. Advice on rolling out the compiler in **existing projects** vs. **new projects**.  
> 6. **Library** concerns and recommended strategies for shipping compiled code.  

---

### Example Usage Scenarios

Below is how you might apply the prompt to shape your own documentation or guidance for the React Compiler.

---

#### 1. Installing and Configuring the Compiler

```ts
// babel.config.ts
const ReactCompilerConfig = {
  // If you need to target older versions:
  target: '18', // or '17', '19'
  sources: (filename: string) => {
    // Only compile files from certain directories during a phased rollout
    return filename.includes('src/critical-path');
  },
};

export default {
  plugins: [
    ['babel-plugin-react-compiler', ReactCompilerConfig], // must run first!
    // other Babel plugins...
  ],
};
```

**Why It Helps**: Ensures the compiler processes only your “critical-path” components initially—so you can test performance gains and gradually expand coverage.

---

#### 2. ESLint Plugin for Rule Checking

```js
// .eslintrc.js (common JS)
module.exports = {
  plugins: [
    'eslint-plugin-react-compiler',
  ],
  rules: {
    'react-compiler/react-compiler': 'error',
  },
};
```

```ts
// eslint.config.ts (ESM)
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
];
```

**Why It Helps**: Surfaces breakages of the Rules of React directly in your editor, so you can fix them and increase the compiler’s coverage.

---

#### 3. Escape Hatch: `"use no memo"`

```tsx
function SuspiciousComponent() {
  "use no memo"; // skip compiler optimization for this component
  // ...
}
```

**Why It Helps**: Temporarily disable compilation on a problematic component or hook until you can debug further. This can stabilize your app if the compiler is misbehaving.

---

#### 4. Using React Compiler With Libraries

```jsonc
// package.json snippet for a library
{
  "name": "my-react-library",
  "dependencies": {
    "react-compiler-runtime": "beta" // ensures runtime for React < 19
  }
}
```

**Why It Helps**: Pre-compiling ensures your end users benefit from the compiler’s memoization even if they haven’t integrated it. The runtime package adds necessary APIs or polyfills.

---

#### 5. Troubleshooting and Debugging

- **DevTools**: Look for the **“Memo ✨”** badge on optimized components.
- **ESLint Errors**: Tackle rules-of-React violations flagged by the plugin.
- **React Compiler Playground**: Reproduce issues before filing a bug report.
- **Incremental Rollout**: Start small, confirm stability, expand coverage.
