# UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared design token system + 9 primitive UI components, convert Team Hub from modal-in-modal to routed pages, and sweep all screens for loading/empty/error states.

**Architecture:** Design tokens flow through Tailwind config → all primitives consume them → feature components are rebuilt on primitives → Team Hub tabs become nested routes under `/team-hub/:id/*` with a persistent `HubDetailLayout`. No new external dependencies beyond what's already in the project.

**Tech Stack:** React 18, React Router DOM, Tailwind CSS, Vite, Vitest + @testing-library/react (added in Task 1)

---

## Task 1: Add Vitest + Testing Library

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/test/setup.js`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 3: Configure Vite for Vitest**

Replace `vite.config.js` content:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/test/setup.js`:
```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verify setup with a smoke test**

Create `src/test/smoke.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'

test('testing library works', () => {
  render(<div>hello</div>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})
```

Run: `npm run test:run`
Expected: 1 test passes

- [ ] **Step 6: Delete the smoke test, commit**

```bash
rm src/test/smoke.test.jsx
git add -A && git commit -m "chore: add vitest + testing-library"
```

---

## Task 2: Design Tokens

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App*.jsx",
    "./app_*.jsx"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          amber:    '#f4b223',
          amethyst: '#9b59d0',
          emerald:  '#2ecc71',
          ruby:     '#e74c5e',
          sapphire: '#3aa0e0',
          steel:    '#9aa7b8',
        },
        bg: {
          base:    '#0e1116',
          raised:  '#161b24',
          overlay: '#1d2430',
        },
        line:  '#2a3340',
        brand: { DEFAULT: '#8b5cf6', fg: '#0e1116' },
        good:  '#2ecc71',
        warn:  '#f4c542',
        bad:   '#e74c5e',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 6px 24px rgba(0,0,0,.35)',
      },
      fontSize: {
        xs:   '12px',
        sm:   '13px',
        base: '14px',
        lg:   '17px',
        xl:   '22px',
        '2xl':'30px',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Verify tokens resolve**

Run `npm run dev` briefly and open the app — it should load without errors. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js && git commit -m "feat: add design tokens to tailwind config"
```

---

## Task 3: Spinner Component

**Files:**
- Create: `src/components/ui/Spinner.jsx`
- Create: `src/components/ui/Spinner.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/Spinner.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import Spinner from './Spinner'

test('renders with default size', () => {
  render(<Spinner />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('renders sm size', () => {
  render(<Spinner size="sm" />)
  const el = screen.getByRole('status')
  expect(el).toHaveClass('w-4')
})

test('renders md size', () => {
  render(<Spinner size="md" />)
  const el = screen.getByRole('status')
  expect(el).toHaveClass('w-6')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/components/ui/Spinner.test.jsx
```
Expected: FAIL — Spinner not found

- [ ] **Step 3: Implement Spinner**

Create `src/components/ui/Spinner.jsx`:
```jsx
const sizeClass = { sm: 'w-4 h-4', md: 'w-6 h-6' }

export default function Spinner({ size = 'md' }) {
  return (
    <span
      role="status"
      className={`inline-block ${sizeClass[size]} border-2 border-current border-t-transparent rounded-full animate-spin opacity-70`}
    />
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/components/ui/Spinner.test.jsx
```
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Spinner.jsx src/components/ui/Spinner.test.jsx
git commit -m "feat: add Spinner primitive"
```

---

## Task 4: Button Component

**Files:**
- Create: `src/components/ui/Button.jsx`
- Create: `src/components/ui/Button.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/Button.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

test('renders children', () => {
  render(<Button>Save</Button>)
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
})

test('calls onClick when clicked', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Save</Button>)
  await user.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('is disabled and shows spinner when loading', () => {
  render(<Button loading>Save</Button>)
  const btn = screen.getByRole('button')
  expect(btn).toBeDisabled()
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('does not fire onClick when disabled', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<Button disabled onClick={onClick}>Save</Button>)
  await user.click(screen.getByRole('button'))
  expect(onClick).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/components/ui/Button.test.jsx
```
Expected: FAIL

- [ ] **Step 3: Implement Button**

Create `src/components/ui/Button.jsx`:
```jsx
import Spinner from './Spinner'

const variants = {
  primary: 'bg-brand text-brand-fg hover:bg-violet-500 border-transparent',
  ghost:   'bg-transparent text-gray-200 hover:bg-white/10 border-line',
  danger:  'bg-bad/10 text-bad hover:bg-bad/20 border-bad/40',
  subtle:  'bg-white/5 text-gray-300 hover:bg-white/10 border-transparent',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon = null,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 font-medium rounded-md border
        transition-colors duration-fast
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/components/ui/Button.test.jsx
```
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.jsx src/components/ui/Button.test.jsx
git commit -m "feat: add Button primitive"
```

---

## Task 5: Card Component

**Files:**
- Create: `src/components/ui/Card.jsx`
- Create: `src/components/ui/Card.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/Card.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import Card from './Card'

test('renders children', () => {
  render(<Card>content</Card>)
  expect(screen.getByText('content')).toBeInTheDocument()
})

test('accepts additional className', () => {
  render(<Card className="extra">content</Card>)
  expect(screen.getByText('content').closest('.extra')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/Card.test.jsx
```

- [ ] **Step 3: Implement Card**

Create `src/components/ui/Card.jsx`:
```jsx
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      {...props}
      className={`bg-bg-raised border border-line rounded-md shadow-card p-4 ${className}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/Card.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.jsx src/components/ui/Card.test.jsx
git commit -m "feat: add Card primitive"
```

---

## Task 6: Badge Component

**Files:**
- Create: `src/components/ui/Badge.jsx`
- Create: `src/components/ui/Badge.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/Badge.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

test('renders label', () => {
  render(<Badge>Legal</Badge>)
  expect(screen.getByText('Legal')).toBeInTheDocument()
})

test('applies good tone', () => {
  render(<Badge tone="good">Legal</Badge>)
  expect(screen.getByText('Legal')).toHaveClass('text-good')
})

test('applies bad tone', () => {
  render(<Badge tone="bad">Banned</Badge>)
  expect(screen.getByText('Banned')).toHaveClass('text-bad')
})

test('applies ink-amber tone', () => {
  render(<Badge tone="ink-amber">Amber</Badge>)
  expect(screen.getByText('Amber')).toHaveClass('text-ink-amber')
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/Badge.test.jsx
```

- [ ] **Step 3: Implement Badge**

Create `src/components/ui/Badge.jsx`:
```jsx
const tones = {
  default:        'bg-white/10 text-gray-300',
  good:           'bg-good/15 text-good',
  warn:           'bg-warn/15 text-warn',
  bad:            'bg-bad/15 text-bad',
  'ink-amber':    'bg-ink-amber/15 text-ink-amber',
  'ink-amethyst': 'bg-ink-amethyst/15 text-ink-amethyst',
  'ink-emerald':  'bg-ink-emerald/15 text-ink-emerald',
  'ink-ruby':     'bg-ink-ruby/15 text-ink-ruby',
  'ink-sapphire': 'bg-ink-sapphire/15 text-ink-sapphire',
  'ink-steel':    'bg-ink-steel/15 text-ink-steel',
}

export default function Badge({ children, tone = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/Badge.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Badge.jsx src/components/ui/Badge.test.jsx
git commit -m "feat: add Badge primitive"
```

---

## Task 7: Input, Select, Textarea Components

**Files:**
- Create: `src/components/ui/Input.jsx`
- Create: `src/components/ui/Select.jsx`
- Create: `src/components/ui/Textarea.jsx`
- Create: `src/components/ui/Input.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/Input.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import Input from './Input'
import Select from './Select'
import Textarea from './Textarea'

test('Input renders with label', () => {
  render(<Input label="Username" id="u" />)
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
})

test('Input shows error', () => {
  render(<Input label="Username" id="u" error="Required" />)
  expect(screen.getByText('Required')).toBeInTheDocument()
})

test('Input shows helper text', () => {
  render(<Input label="Username" id="u" helper="Your username" />)
  expect(screen.getByText('Your username')).toBeInTheDocument()
})

test('Select renders with label', () => {
  render(
    <Select label="Ink" id="ink">
      <option value="amber">Amber</option>
    </Select>
  )
  expect(screen.getByLabelText('Ink')).toBeInTheDocument()
})

test('Textarea renders with label', () => {
  render(<Textarea label="Notes" id="notes" />)
  expect(screen.getByLabelText('Notes')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/Input.test.jsx
```

- [ ] **Step 3: Implement Input**

Create `src/components/ui/Input.jsx`:
```jsx
export default function Input({ label, id, error, helper, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm text-gray-300">{label}</label>}
      <input
        id={id}
        {...props}
        className={`
          h-9 px-3 rounded-md bg-bg-overlay border text-sm text-gray-100
          placeholder:text-gray-500 outline-none
          focus:ring-2 focus:ring-brand focus:border-transparent
          ${error ? 'border-bad' : 'border-line'}
          ${className}
        `}
      />
      {error  && <p className="text-xs text-bad">{error}</p>}
      {helper && !error && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Implement Select**

Create `src/components/ui/Select.jsx`:
```jsx
export default function Select({ label, id, error, helper, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm text-gray-300">{label}</label>}
      <select
        id={id}
        {...props}
        className={`
          h-9 px-3 rounded-md bg-bg-overlay border text-sm text-gray-100
          outline-none focus:ring-2 focus:ring-brand focus:border-transparent
          ${error ? 'border-bad' : 'border-line'}
          ${className}
        `}
      >
        {children}
      </select>
      {error  && <p className="text-xs text-bad">{error}</p>}
      {helper && !error && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Implement Textarea**

Create `src/components/ui/Textarea.jsx`:
```jsx
export default function Textarea({ label, id, error, helper, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm text-gray-300">{label}</label>}
      <textarea
        id={id}
        {...props}
        className={`
          px-3 py-2 rounded-md bg-bg-overlay border text-sm text-gray-100
          placeholder:text-gray-500 outline-none resize-y min-h-[80px]
          focus:ring-2 focus:ring-brand focus:border-transparent
          ${error ? 'border-bad' : 'border-line'}
          ${className}
        `}
      />
      {error  && <p className="text-xs text-bad">{error}</p>}
      {helper && !error && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/Input.test.jsx
```
Expected: 5 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Input.jsx src/components/ui/Select.jsx src/components/ui/Textarea.jsx src/components/ui/Input.test.jsx
git commit -m "feat: add Input, Select, Textarea primitives"
```

---

## Task 8: Tabs Component

**Files:**
- Create: `src/components/ui/Tabs.jsx`
- Create: `src/components/ui/Tabs.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/Tabs.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tabs from './Tabs'

const tabs = [
  { label: 'Roster', value: 'roster' },
  { label: 'Pods',   value: 'pods'   },
]

test('renders all tab labels', () => {
  render(<Tabs tabs={tabs} value="roster" onChange={() => {}} />)
  expect(screen.getByRole('tab', { name: 'Roster' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Pods' })).toBeInTheDocument()
})

test('active tab has aria-selected true', () => {
  render(<Tabs tabs={tabs} value="roster" onChange={() => {}} />)
  expect(screen.getByRole('tab', { name: 'Roster' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Pods' })).toHaveAttribute('aria-selected', 'false')
})

test('calls onChange with value when tab is clicked', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Tabs tabs={tabs} value="roster" onChange={onChange} />)
  await user.click(screen.getByRole('tab', { name: 'Pods' }))
  expect(onChange).toHaveBeenCalledWith('pods')
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/Tabs.test.jsx
```

- [ ] **Step 3: Implement Tabs**

Create `src/components/ui/Tabs.jsx`:
```jsx
export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`flex gap-1 border-b border-line ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`
            px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors duration-fast
            ${value === tab.value
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-400 hover:text-gray-100'}
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/Tabs.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Tabs.jsx src/components/ui/Tabs.test.jsx
git commit -m "feat: add Tabs primitive"
```

---

## Task 9: EmptyState Component

**Files:**
- Create: `src/components/ui/EmptyState.jsx`
- Create: `src/components/ui/EmptyState.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/EmptyState.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmptyState from './EmptyState'

test('renders title and description', () => {
  render(<EmptyState title="No members" description="Invite someone to get started." />)
  expect(screen.getByText('No members')).toBeInTheDocument()
  expect(screen.getByText('Invite someone to get started.')).toBeInTheDocument()
})

test('renders action button when provided', () => {
  render(
    <EmptyState
      title="No members"
      action={{ label: 'Invite', onClick: () => {} }}
    />
  )
  expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument()
})

test('fires action onClick', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<EmptyState title="No members" action={{ label: 'Invite', onClick }} />)
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/EmptyState.test.jsx
```

- [ ] **Step 3: Implement EmptyState**

Create `src/components/ui/EmptyState.jsx`:
```jsx
import Button from './Button'

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon && <div className="text-4xl text-gray-600">{icon}</div>}
      <p className="text-base font-medium text-gray-300">{title}</p>
      {description && <p className="text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/EmptyState.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/EmptyState.jsx src/components/ui/EmptyState.test.jsx
git commit -m "feat: add EmptyState primitive"
```

---

## Task 10: Skeleton Component

**Files:**
- Create: `src/components/ui/Skeleton.jsx`
- Create: `src/components/ui/Skeleton.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/Skeleton.test.jsx`:
```jsx
import { render } from '@testing-library/react'
import Skeleton from './Skeleton'

test('renders line variant', () => {
  render(<Skeleton variant="line" />)
  expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
})

test('renders card variant', () => {
  render(<Skeleton variant="card" />)
  expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
})

test('renders block variant', () => {
  render(<Skeleton variant="block" />)
  expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/Skeleton.test.jsx
```

- [ ] **Step 3: Implement Skeleton**

Create `src/components/ui/Skeleton.jsx`:
```jsx
export default function Skeleton({ variant = 'line', className = '' }) {
  if (variant === 'card') {
    return (
      <div className={`animate-pulse bg-bg-raised border border-line rounded-md p-4 ${className}`}>
        <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
        <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
        <div className="h-3 bg-white/10 rounded w-2/3" />
      </div>
    )
  }
  if (variant === 'block') {
    return (
      <div className={`animate-pulse bg-white/10 rounded-md ${className}`} style={{ minHeight: 80 }} />
    )
  }
  return (
    <div className={`animate-pulse h-4 bg-white/10 rounded w-full ${className}`} />
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/Skeleton.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Skeleton.jsx src/components/ui/Skeleton.test.jsx
git commit -m "feat: add Skeleton primitive"
```

---

## Task 11: Toast Component + Provider

**Files:**
- Create: `src/components/ui/Toast.jsx`
- Create: `src/components/ui/Toast.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/Toast.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from './Toast'

function Trigger() {
  const { toast } = useToast()
  return (
    <>
      <button onClick={() => toast.success('Saved!')}>success</button>
      <button onClick={() => toast.error('Failed!')}>error</button>
    </>
  )
}

function Wrapper() {
  return (
    <ToastProvider>
      <Trigger />
    </ToastProvider>
  )
}

test('shows success toast', async () => {
  const user = userEvent.setup()
  render(<Wrapper />)
  await user.click(screen.getByText('success'))
  expect(screen.getByText('Saved!')).toBeInTheDocument()
})

test('shows error toast', async () => {
  const user = userEvent.setup()
  render(<Wrapper />)
  await user.click(screen.getByText('error'))
  expect(screen.getByText('Failed!')).toBeInTheDocument()
})

test('dismisses toast on close click', async () => {
  const user = userEvent.setup()
  render(<Wrapper />)
  await user.click(screen.getByText('success'))
  await user.click(screen.getByRole('button', { name: '×' }))
  expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/ui/Toast.test.jsx
```

- [ ] **Step 3: Implement Toast**

Create `src/components/ui/Toast.jsx`:
```jsx
import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

const toneClass = {
  success: 'border-good/40 bg-good/10 text-good',
  error:   'border-bad/40 bg-bad/10 text-bad',
  info:    'border-brand/40 bg-brand/10 text-brand',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((message, variant = 'info') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const toast = {
    success: (msg) => add(msg, 'success'),
    error:   (msg) => add(msg, 'error'),
    info:    (msg) => add(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-md border text-sm shadow-card ${toneClass[t.variant]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              aria-label="×"
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100 font-bold text-base leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/components/ui/Toast.test.jsx
```

- [ ] **Step 5: Add ToastProvider to main.jsx**

In `src/main.jsx`, wrap the app. Read the current file first, then add the import and wrapper:
```jsx
import { ToastProvider } from './components/ui/Toast'
// wrap root render:
root.render(
  <React.StrictMode>
    <ToastProvider>
      <RouterApp />
    </ToastProvider>
  </React.StrictMode>
)
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Toast.jsx src/components/ui/Toast.test.jsx src/main.jsx
git commit -m "feat: add Toast primitive + ToastProvider"
```

---

## Task 12: UI Barrel Export

**Files:**
- Create: `src/components/ui/index.js`

- [ ] **Step 1: Create barrel file**

Create `src/components/ui/index.js`:
```js
export { default as Button }     from './Button'
export { default as Card }       from './Card'
export { default as Badge }      from './Badge'
export { default as Input }      from './Input'
export { default as Select }     from './Select'
export { default as Textarea }   from './Textarea'
export { default as Tabs }       from './Tabs'
export { default as EmptyState } from './EmptyState'
export { default as Skeleton }   from './Skeleton'
export { default as Spinner }    from './Spinner'
export { ToastProvider, useToast } from './Toast'
```

- [ ] **Step 2: Run all UI tests**

```bash
npm run test:run -- src/components/ui/
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/index.js
git commit -m "feat: add ui barrel export"
```

---

## Task 13: HubDetailLayout

**Files:**
- Create: `src/pages/HubDetailLayout.jsx`

This replaces `HubDetailModal.jsx` as the persistent hub shell. It fetches hub metadata once and renders a sub-nav + `<Outlet />`.

- [ ] **Step 1: Create HubDetailLayout**

Create `src/pages/HubDetailLayout.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Skeleton } from '../components/ui'

const NAV_TABS = [
  { label: 'Roster',    path: 'roster'    },
  { label: 'Pods',      path: 'pods'      },
  { label: 'Practices', path: 'practices' },
  { label: 'Events',    path: 'events'    },
  { label: 'Reports',   path: 'reports'   },
  { label: 'Reviews',   path: 'reviews'   },
  { label: 'Primers',   path: 'primers'   },
  { label: 'Playtest',  path: 'playtest'  },
]

export default function HubDetailLayout() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/hubs/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setHub(data))
      .catch(() => setError('Failed to load hub'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton variant="line" className="w-48" />
        <Skeleton variant="line" className="w-32" />
      </div>
    )
  }

  if (error) {
    return <p className="text-bad p-4">{error}</p>
  }

  const memberCount = (hub.members?.length ?? 0) + 1
  const isOwner = hub.ownerId === user?.id

  const navLinkClass = ({ isActive }) =>
    `px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors duration-fast whitespace-nowrap ${
      isActive
        ? 'border-brand text-brand'
        : 'border-transparent text-gray-400 hover:text-gray-100'
    }`

  return (
    <div className="space-y-4">
      {/* Hub header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{hub.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {memberCount} member{memberCount !== 1 ? 's' : ''} •{' '}
            Invite code:{' '}
            <span className="font-mono bg-bg-overlay px-1.5 py-0.5 rounded text-gray-300">
              {hub.inviteCode}
            </span>
          </p>
        </div>
        <button
          onClick={() => navigate('/team-hub')}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to hubs
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {NAV_TABS.map(tab => (
          <NavLink key={tab.path} to={tab.path} className={navLinkClass}>
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Tab content */}
      <Outlet context={{ hub, user, isOwner }} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/HubDetailLayout.jsx
git commit -m "feat: add HubDetailLayout with sub-nav"
```

---

## Task 14: Hub Page Wrappers

**Files:**
- Create: `src/pages/hub/RosterPage.jsx`
- Create: `src/pages/hub/PodsPage.jsx`
- Create: `src/pages/hub/PracticesPage.jsx`
- Create: `src/pages/hub/EventsPage.jsx`
- Create: `src/pages/hub/ReportsPage.jsx`
- Create: `src/pages/hub/ReviewsPage.jsx`
- Create: `src/pages/hub/PrimersPage.jsx`
- Create: `src/pages/hub/PlaytestPage.jsx`

Each page reads context from `useOutletContext()` and passes the right props to the existing tab component.

- [ ] **Step 1: Create RosterPage**

Create `src/pages/hub/RosterPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import RosterTab from '../../components/team/RosterTab'

export default function RosterPage() {
  const { hub, user } = useOutletContext()
  return <RosterTab hubId={hub.id} currentUser={user} />
}
```

- [ ] **Step 2: Create PodsPage**

Create `src/pages/hub/PodsPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import PodsTab from '../../components/team/PodsTab'

export default function PodsPage() {
  const { hub, user } = useOutletContext()
  return <PodsTab hubId={hub.id} currentUser={user} />
}
```

- [ ] **Step 3: Create PracticesPage**

Create `src/pages/hub/PracticesPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import PracticesTab from '../../components/team/PracticesTab'

export default function PracticesPage() {
  const { hub, user, isOwner } = useOutletContext()
  return <PracticesTab hubId={hub.id} currentUser={user} isOwner={isOwner} />
}
```

- [ ] **Step 4: Create EventsPage**

Create `src/pages/hub/EventsPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import EventsPanel from '../../components/EventsPanel'

export default function EventsPage() {
  const { hub, user, isOwner } = useOutletContext()
  return (
    <EventsPanel
      hubId={hub.id}
      currentUser={user}
      isOwner={isOwner}
      initialWebhook={hub.discordWebhookUrl || ''}
    />
  )
}
```

- [ ] **Step 5: Create ReportsPage**

Create `src/pages/hub/ReportsPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import MetaReportsTab from '../../components/team/MetaReportsTab'

export default function ReportsPage() {
  const { hub, user, isOwner } = useOutletContext()
  return <MetaReportsTab hubId={hub.id} currentUser={user} isOwner={isOwner} />
}
```

- [ ] **Step 6: Create ReviewsPage**

Create `src/pages/hub/ReviewsPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import LlmBudgetBar from '../../components/LlmBudgetBar'
import PaperReviewForm from '../../components/PaperReviewForm'
import InsightsWidget from '../../components/InsightsWidget'
import ReplayReviewPanel from '../../components/ReplayReviewPanel'

export default function ReviewsPage() {
  const { hub } = useOutletContext()
  return (
    <div className="space-y-4">
      <LlmBudgetBar hubId={hub.id} />
      <PaperReviewForm hubId={hub.id} />
      <InsightsWidget hubId={hub.id} />
      <ReplayReviewPanel hubId={hub.id} />
    </div>
  )
}
```

- [ ] **Step 7: Create PrimersPage**

Create `src/pages/hub/PrimersPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import ReplayReviewPanel from '../../components/ReplayReviewPanel'

export default function PrimersPage() {
  const { hub } = useOutletContext()
  return <ReplayReviewPanel hubId={hub.id} />
}
```

- [ ] **Step 8: Create PlaytestPage**

Create `src/pages/hub/PlaytestPage.jsx`:
```jsx
import { useOutletContext } from 'react-router-dom'
import PlaytestLog from '../../components/PlaytestLog'

export default function PlaytestPage() {
  const { hub, user } = useOutletContext()
  return <PlaytestLog hubId={hub.id} currentUser={user} decks={[]} />
}
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/hub/
git commit -m "feat: add hub page wrappers for all 8 tabs"
```

---

## Task 15: HubListPage

**Files:**
- Create: `src/pages/HubListPage.jsx`

- [ ] **Step 1: Create HubListPage**

Create `src/pages/HubListPage.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, Card, Input, Skeleton, EmptyState, useToast } from '../components/ui'

export default function HubListPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [hubs, setHubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [hubName, setHubName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch('/api/hubs')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setHubs)
      .catch(() => toast.error('Failed to load hubs'))
      .finally(() => setLoading(false))
  }, [user])

  const createHub = async (e) => {
    e.preventDefault()
    if (!hubName.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hubName }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      const hub = await r.json()
      setHubs(prev => [...prev, hub])
      setHubName('')
      setShowCreate(false)
      toast.success('Hub created')
    } catch (err) {
      toast.error(err.message || 'Failed to create hub')
    } finally {
      setSaving(false)
    }
  }

  const joinHub = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/hubs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      const hub = await r.json()
      setHubs(prev => [...prev.filter(h => h.id !== hub.id), hub])
      setInviteCode('')
      setShowJoin(false)
      toast.success('Joined hub')
    } catch (err) {
      toast.error(err.message || 'Failed to join hub')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return <EmptyState title="Sign in to access team hubs" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Team Hubs</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowJoin(v => !v)}>Join Hub</Button>
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>+ New Hub</Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <form onSubmit={createHub} className="flex gap-2 items-end">
            <Input id="hub-name" label="Hub name" value={hubName} onChange={e => setHubName(e.target.value)} placeholder="My Team" className="flex-1" />
            <Button type="submit" loading={saving} size="sm">Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          </form>
        </Card>
      )}

      {showJoin && (
        <Card>
          <form onSubmit={joinHub} className="flex gap-2 items-end">
            <Input id="invite-code" label="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="ABCDEF" className="flex-1" />
            <Button type="submit" loading={saving} size="sm">Join</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowJoin(false)}>Cancel</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      ) : hubs.length === 0 ? (
        <EmptyState
          title="No hubs yet"
          description="Create a hub to share decks and coordinate with your team."
          action={{ label: '+ New Hub', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.map(hub => (
            <Card
              key={hub.id}
              className="cursor-pointer hover:border-brand/50 transition-colors"
              onClick={() => navigate(`/team-hub/${hub.id}`)}
            >
              <h3 className="font-semibold text-white">{hub.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {(hub.members?.length ?? 0) + 1} member{(hub.members?.length ?? 0) + 1 !== 1 ? 's' : ''}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/HubListPage.jsx
git commit -m "feat: add HubListPage with primitives"
```

---

## Task 16: Wire Up Routing in RouterApp

**Files:**
- Modify: `src/RouterApp.jsx`

- [ ] **Step 1: Replace RouterApp.jsx**

Replace the entire contents of `src/RouterApp.jsx`:
```jsx
import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AuthButton from './components/AuthButton'
import { Skeleton } from './components/ui'

const DeckBuilderApp  = lazy(() => import('./App.jsx'))
const HubListPage     = lazy(() => import('./pages/HubListPage.jsx'))
const HubDetailLayout = lazy(() => import('./pages/HubDetailLayout.jsx'))
const RosterPage      = lazy(() => import('./pages/hub/RosterPage.jsx'))
const PodsPage        = lazy(() => import('./pages/hub/PodsPage.jsx'))
const PracticesPage   = lazy(() => import('./pages/hub/PracticesPage.jsx'))
const EventsPage      = lazy(() => import('./pages/hub/EventsPage.jsx'))
const ReportsPage     = lazy(() => import('./pages/hub/ReportsPage.jsx'))
const ReviewsPage     = lazy(() => import('./pages/hub/ReviewsPage.jsx'))
const PrimersPage     = lazy(() => import('./pages/hub/PrimersPage.jsx'))
const PlaytestPage    = lazy(() => import('./pages/hub/PlaytestPage.jsx'))

function TopNav() {
  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-900/40 border-gray-800 text-gray-200 hover:bg-gray-800'
    }`

  return (
    <div className="sticky top-0 z-50 border-b border-gray-800 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-violet-400">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_0_14px_-2px_rgba(139,108,255,0.7)] inline-block" aria-hidden="true" />
            Lorcana Deck Builder
          </Link>
          <NavLink to="/builder" className={linkClass}>Deck Builder</NavLink>
          <NavLink to="/team-hub" className={linkClass}>Team Hub</NavLink>
        </div>
        <AuthButton />
      </div>
    </div>
  )
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100">
      <TopNav />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Suspense fallback={<Skeleton variant="card" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}

export default function RouterApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DeckBuilderApp />} />
          <Route path="/builder" element={<DeckBuilderApp />} />
          <Route path="/team-hub" element={<HubListPage />} />
          <Route path="/team-hub/:id" element={<HubDetailLayout />}>
            <Route index element={<Navigate to="roster" replace />} />
            <Route path="roster"    element={<RosterPage />} />
            <Route path="pods"      element={<PodsPage />} />
            <Route path="practices" element={<PracticesPage />} />
            <Route path="events"    element={<EventsPage />} />
            <Route path="reports"   element={<ReportsPage />} />
            <Route path="reviews"   element={<ReviewsPage />} />
            <Route path="primers"   element={<PrimersPage />} />
            <Route path="playtest"  element={<PlaytestPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Check that `/api/hubs/:id` exists**

Run: `ls api/hubs/`

If there is no `[id].js` at the top level of `api/hubs/` (only a `[id]/` subdirectory with nested routes), create `api/hubs/[id].js`:
```js
import { PrismaClient } from '@prisma/client'
import { getUserFromRequest } from '../_lib/hubAuth.js'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await getUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.query
  try {
    const hub = await prisma.hub.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        owner: { select: { id: true, email: true } },
        members: { include: { user: { select: { id: true, email: true } } } },
      },
    })
    if (!hub) return res.status(404).json({ error: 'Hub not found' })
    res.json(hub)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
```

- [ ] **Step 3: Start dev server and manually verify routing**

```bash
npm run dev
```

- Navigate to `http://localhost:5173/team-hub` → hub list with create/join
- Click a hub → navigates to `/team-hub/:id/roster`
- Click each sub-nav tab → URL updates, content switches
- Browser back button → returns to `/team-hub`
- Paste `/team-hub/:id/pods` directly in address bar → loads pods tab

- [ ] **Step 4: Commit**

```bash
git add src/RouterApp.jsx api/hubs/
git commit -m "feat: wire hub sub-routes in RouterApp"
```

---

## Task 17: Delete HubDetailModal

**Files:**
- Modify: `src/components/TeamHub.jsx`
- Delete: `src/components/HubDetailModal.jsx`

- [ ] **Step 1: Remove HubDetailModal from TeamHub.jsx**

In `src/components/TeamHub.jsx`:
1. Remove `import HubDetailModal from './HubDetailModal'`
2. Remove `selectedHub`, `showHubDetail` state declarations
3. Remove the `<HubDetailModal ...>` JSX block (and its conditional render)
4. Remove any `setSelectedHub(hub)` / `setShowHubDetail(true)` calls
5. Add `import { useNavigate } from 'react-router-dom'` at top
6. Add `const navigate = useNavigate()` inside the component
7. Replace hub card click handlers with `navigate(\`/team-hub/${hub.id}\`)`

- [ ] **Step 2: Delete HubDetailModal.jsx**

```bash
rm src/components/HubDetailModal.jsx
```

- [ ] **Step 3: Confirm no import errors**

```bash
npm run dev
```
Open the browser console — no missing module errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: delete HubDetailModal — hub fully routed"
```

---

## Task 18: Consistency Pass — RosterTab

**Files:**
- Modify: `src/components/team/RosterTab.jsx`

- [ ] **Step 1: Read the file**

Open `src/components/team/RosterTab.jsx` and note every instance of:
- Bare `"Loading…"` text or spinner divs
- Empty-list states with no CTA
- Raw `<button>` elements
- `alert()` calls or silent catch blocks

- [ ] **Step 2: Apply changes**

Add at top:
```jsx
import { Button, Skeleton, EmptyState, useToast } from '../ui'
```

Add inside the component function:
```jsx
const { toast } = useToast()
```

Replace loading state (find the loading conditional and replace with):
```jsx
<div className="space-y-2">
  {[1, 2, 3].map(i => <Skeleton key={i} variant="line" />)}
</div>
```

Replace empty roster (find the empty members state and replace with):
```jsx
<EmptyState
  title="No members yet"
  description="Members will appear here once they join the hub."
/>
```

Replace every `setError('...')` or silent catch with `toast.error('...')`.
Replace raw `<button className="...">` with `<Button variant="ghost" size="sm">`.

- [ ] **Step 3: Verify at `/team-hub/:id/roster`**

- [ ] **Step 4: Commit**

```bash
git add src/components/team/RosterTab.jsx
git commit -m "polish: apply primitives to RosterTab"
```

---

## Task 19: Consistency Pass — PodsTab

**Files:**
- Modify: `src/components/team/PodsTab.jsx`

- [ ] **Step 1: Apply same pattern as Task 18**

Add at top:
```jsx
import { Button, Card, Skeleton, EmptyState, useToast } from '../ui'
```
Add `const { toast } = useToast()` inside the component.

- Replace loading states with `<Skeleton variant="card" />`
- Replace empty pod list with:
```jsx
<EmptyState
  title="No pods yet"
  description="Create a pod to organize team members into groups."
  action={{ label: 'Create Pod', onClick: () => setShowCreate(true) }}
/>
```
- Replace raw `<button>` with `<Button />`
- Replace `alert()` / silent errors with `toast.error()`
- Replace successful saves with `toast.success('Pod saved')`

- [ ] **Step 2: Verify at `/team-hub/:id/pods`**

- [ ] **Step 3: Commit**

```bash
git add src/components/team/PodsTab.jsx
git commit -m "polish: apply primitives to PodsTab"
```

---

## Task 20: Consistency Pass — PracticesTab

**Files:**
- Modify: `src/components/team/PracticesTab.jsx`

- [ ] **Step 1: Apply same pattern**

Add at top:
```jsx
import { Button, Card, Skeleton, EmptyState, useToast } from '../ui'
```
Add `const { toast } = useToast()` inside the component.

- Replace loading with Skeleton
- Replace empty list with:
```jsx
<EmptyState
  title="No practices scheduled"
  description="Schedule a practice session for your team."
  action={isOwner ? { label: 'Schedule Practice', onClick: () => setShowCreate(true) } : undefined}
/>
```
- Replace raw buttons with `<Button />`
- Replace silent errors with `toast.error()`
- Replace successful saves with `toast.success('Practice saved')`

- [ ] **Step 2: Verify at `/team-hub/:id/practices`**

- [ ] **Step 3: Commit**

```bash
git add src/components/team/PracticesTab.jsx
git commit -m "polish: apply primitives to PracticesTab"
```

---

## Task 21: Consistency Pass — MetaReportsTab

**Files:**
- Modify: `src/components/team/MetaReportsTab.jsx`

- [ ] **Step 1: Apply same pattern**

Add at top:
```jsx
import { Button, Card, Skeleton, EmptyState, Badge, useToast } from '../ui'
```
Add `const { toast } = useToast()` inside the component.

- Replace loading with `<Skeleton variant="card" />`
- Replace empty reports list with:
```jsx
<EmptyState
  title="No reports yet"
  description="Reports will appear here as your team logs matches."
/>
```
- Replace raw buttons with `<Button />`
- Replace silent errors with `toast.error()`

- [ ] **Step 2: Verify at `/team-hub/:id/reports`**

- [ ] **Step 3: Commit**

```bash
git add src/components/team/MetaReportsTab.jsx
git commit -m "polish: apply primitives to MetaReportsTab"
```

---

## Task 22: Consistency Pass — PlaytestLog + ReplayUpload

**Files:**
- Modify: `src/components/PlaytestLog.jsx`
- Modify: `src/components/ReplayUpload.jsx`

- [ ] **Step 1: Update PlaytestLog.jsx**

Add at top:
```jsx
import { Button, Skeleton, EmptyState, useToast } from './ui'
```
Add `const { toast } = useToast()` inside the component.

- Replace loading with Skeleton
- Replace empty session list with:
```jsx
<EmptyState
  title="No playtest sessions yet"
  description="Upload a match replay or log a session to get started."
/>
```
- Replace raw buttons with `<Button />`
- Replace silent errors with `toast.error()`

- [ ] **Step 2: Update ReplayUpload.jsx**

Add at top:
```jsx
import { Button, useToast } from './ui'
```
Add `const { toast } = useToast()` inside the component.

- Replace the upload submit button with:
```jsx
<Button type="submit" loading={uploading}>Upload Replay</Button>
```
- Replace `alert('...')` error messages with `toast.error('...')`
- Replace success state/alert with `toast.success('Replay uploaded')`

- [ ] **Step 3: Verify at `/team-hub/:id/playtest`**

- [ ] **Step 4: Commit**

```bash
git add src/components/PlaytestLog.jsx src/components/ReplayUpload.jsx
git commit -m "polish: apply primitives to PlaytestLog and ReplayUpload"
```

---

## Task 23: Consistency Pass — EventsPanel

**Files:**
- Modify: `src/components/EventsPanel.jsx`

- [ ] **Step 1: Apply same pattern**

Add at top:
```jsx
import { Button, Card, Skeleton, EmptyState, Badge, useToast } from './ui'
```
Add `const { toast } = useToast()` inside the component.

- Replace loading with Skeleton
- Replace empty events list with:
```jsx
<EmptyState
  title="No events yet"
  description="Schedule an event for your team."
  action={isOwner ? { label: 'Add Event', onClick: () => setShowCreate(true) } : undefined}
/>
```
- Replace RSVP status text with:
```jsx
<Badge tone={rsvp === 'yes' ? 'good' : rsvp === 'no' ? 'bad' : 'default'}>
  {rsvp}
</Badge>
```
- Replace raw buttons with `<Button />`
- Replace silent errors with `toast.error()`

- [ ] **Step 2: Verify at `/team-hub/:id/events`**

- [ ] **Step 3: Commit**

```bash
git add src/components/EventsPanel.jsx
git commit -m "polish: apply primitives to EventsPanel"
```

---

## Task 24: Run Full Test Suite + Smoke Check

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```
Expected: all tests pass (no failures)

- [ ] **Step 2: Full manual smoke check**

```bash
npm run dev
```

Visit each route and verify:
- `/` — deck builder loads normally
- `/team-hub` — hub list with skeleton on load; create/join forms use Input + Button
- `/team-hub/:id/roster` — skeleton while loading, empty state if no members, no bare "Loading…"
- `/team-hub/:id/pods` — same quality
- `/team-hub/:id/practices` — same quality
- `/team-hub/:id/events` — same quality, RSVP Badges visible
- `/team-hub/:id/reports` — same quality
- `/team-hub/:id/reviews` — loads reviews components
- `/team-hub/:id/primers` — loads primers component
- `/team-hub/:id/playtest` — skeleton, empty state, upload button uses Button primitive
- Browser back button works inside hub
- Pasting `/team-hub/:id/pods` directly in address bar loads the correct tab
- Toast appears on create hub, join hub, save actions
- Toast appears on errors instead of silent failures

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: ux overhaul complete — primitives, routing, consistency pass"
```
