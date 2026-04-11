---
name: typescript-vue
description: TypeScript and Vue 3 coding standards for this project. Use when writing or reviewing TypeScript/Vue code, creating components, composables, stores, or services. Covers types, SFC structure, composable patterns, Pinia stores, and project-specific constraints.
metadata:
  version: 1.0.0
---

# TypeScript & Vue 3 Coding Standards

Comprehensive reference for writing TypeScript in Vue 3 components, composables, stores, and services in this project.

---

## TypeScript

### No `any` — Ever

- `any` is **STRICTLY PROHIBITED**, including at layer boundaries
- Use `unknown` for truly unknown types
- Use proper generics or union types
- Document exceptions only for third-party compatibility

### No Inline Types

Always extract types to separate declarations — never define `type` or `interface` inside a function, component, or
expression.

### Type vs Interface

**Use `interface` for:**

- Object structures that may be extended or merged
- Class contracts
- Plugin/library public APIs meant for extension

**Use `type` for:**

- Utilities (`Partial`, `Readonly`, etc.)
- Complex manipulations (conditional, mapped types)
- Unions and intersections
- Template literals and callbacks
- Data models
- Aliases

```ts
// interface for object contracts
interface UserProfile {
  id: string
  name: string
}

// type for unions, aliases, mapped types
type UserId = string
type UserRole = 'admin' | 'user' | 'guest'
type PartialUser = Partial<UserProfile>
```

### Enums over Union Types

Prefer `enum` or `const enum` over union types for fixed value sets — better IDE support, autocomplete, refactoring
safety:

```ts
// ✅ Preferred
enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

// Use only for simple cases
type Status = 'active' | 'inactive'
```

### Naming

- PascalCase for `type`/`interface` — **no prefixes** (`I`, `T`, etc.)
- camelCase for fields and parameters

### Where to Put Types

- Shared types → `src/types/`
- Module-specific types → module folder (e.g., `src/components/HookReplacement/types.ts`)
- Check if a type already exists before creating a new one; extend/compose when possible

### Explicit Typing Rules

- Type `ref` and `computed` explicitly when: no default value, literal/union/enum type, or complex calculation
- Skip when TypeScript can infer correctly
- Always use `:` annotation (not `as`) to avoid ref unwrapping issues
- Export types separately: `import type { ... }`

### JSDoc for Complex Types

Add JSDoc when a type has 5+ properties, generic parameters, conditional/mapped types, or non-obvious business logic.

---

## Vue 3 SFC

### Script Block Order

```vue

<script setup lang="ts">
  // 1. Imports
  import { ref, computed, onMounted } from 'vue'
  import { useFeature } from './composables/useFeature'

  // 2. Props & Emits
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  // 3. Composables
  const { data, isLoading } = useFeature()

  // 4. Reactive state
  const isOpen = ref(false)

  // 5. Computed
  const displayName = computed(() =>
  ...)

  // 6. Watchers
  watch(isOpen, () => { ...
  })

  // 7. Methods
  const handleSubmit = () => { ...
  }

  // 8. Lifecycle hooks
  onMounted(() => { ...
  })
</script>

<template>
  <!-- Single root element preferred -->
</template>

<style scoped lang="scss">
  /* Component styles */
</style>
```

### Rules

- **Always `<script setup lang="ts">`** — no Options API ever
- **Always `scoped` styles** — no CSS leaking
- Keep component under ~200 lines — extract logic to composables
- No `async` operations or business logic in components — delegate to composables

### Props & Emits

```ts
// ✅ Type-based props declaration
const props = defineProps<Props>()

// ✅ With defaults
const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
})

// ✅ Typed emits — object syntax
const emit = defineEmits<{
  submit: [value: string]
  close: []
}>()
```

- Use type-based declaration, not runtime validation
- Use `withDefaults()` for defaults; wrap objects/arrays in factory functions

### v-model — `defineModel` (Vue 3.4+)

```ts
// ✅ Correct
const modelValue = defineModel<string>()

// ❌ Wrong — manual pattern
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
```

### Template Directives

- `v-show` — frequent toggling (stays in DOM)
- `v-if` / `v-else` — conditional rendering (removed from DOM)
- `<component :is="">` — over long `v-if`/`v-else-if` chains
- `v-memo` — expensive renders
- `v-once` — static content
- Semantic HTML tags always

---

## Composables

### Structure Rules

- **One composable = one responsibility (SRP)**
- **Always return an object** — never a ref, array, or primitive
- **3–7 return properties** — if more, split the composable
- **50–100 lines** — if longer, compose multiple composables
- Always specify return types explicitly

```ts
// ✅ Correct
export const useUserProfile = (): UserProfileReturns => {
  const store = useUserStore()

  const isLoading = ref(false)
  const profile = computed(() => store.profile)

  const fetchProfile = async (id: string) => {
    isLoading.value = true
    await store.loadProfile(id)
    isLoading.value = false
  }

  return { isLoading, profile, fetchProfile }
}

// ❌ Wrong — returns primitive
export const useCounter = () => ref(0)
```

### Composing Composables

```ts
export const useCheckout = () => {
  const { cart, total } = useCart()
  const { isProcessing, processPayment } = usePayment()
  const { address } = useShipping()

  return { cart, total, isProcessing, address, processPayment }
}
```

---

## Pinia Stores

- **Setup syntax only** — no Options API stores ever
- No direct state mutation from outside the store
- Use actions for all state changes
- **Never store derived state in `ref`** — use `computed()`

```ts
// ✅ Setup syntax
export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(false)

  const loadProfile = async (id: string) => {
    isLoading.value = true
    profile.value = await UserApiService.fetchUser(id)
    isLoading.value = false
  }

  return { profile, isLoading, loadProfile }
})

// ❌ Options API — never use
export const useUserStore = defineStore('user', {
  state: () => ({ ... }),
  actions: { ... },
})
```

---

## Layer Rules (strictly enforced)

```
Component → Composable → Store → Service → API
```

- Components import from composables only — **never** from stores or services directly
- Stores never import from composables
- Services never use `ref()`, `reactive()`, `computed()`, or `watch()`
- Business logic lives in composables, not components

---

## Flow Control

Guard clauses and early returns — avoid deep nesting:

```ts
// ✅ Correct
const processUser = (user: User | null) => {
  if (!user) return
  if (!user.isActive) return

  doSomething(user)
}

// ❌ Wrong — deep nesting
const processUser = (user: User | null) => {
  if (user) {
    if (user.isActive) {
      doSomething(user)
    }
  }
}
```

---

## Reactivity Anti-Patterns

- **Never store derived state in `ref`** — use `computed()`
- **Never use `watch` just to sync a computed value into a ref** — that's what `computed` is for
- `watch` / `watchEffect` should only synchronize with **external systems** (DOM, local storage, external APIs)

---

## Project-Specific Don'ts

- No `require()` — ES module `import`/`export` only
- No hardcoded env-specific URLs — use `.env` + `projectEnvVariables.ts`
- No semicolons, use single quotes, 2-space indent, 100 char print width, trailing commas
- Import order: builtin → external → internal → parent → sibling
- PascalCase for components and service classes; camelCase for variables/methods
