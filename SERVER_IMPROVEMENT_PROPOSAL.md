# Server-Side Improvement Proposal

## Current State (Factory Pattern)

**Current Usage:**
```typescript
// Setup - must create factories first
import { createWithAuth, createWithPermission } from "@raburski/next-auth-permissions/server"
import { auth } from "@/server/auth"
import { permissionConfig } from "@/lib/auth-permissions"

const withAuth = createWithAuth(() => auth())
const withPermission = createWithPermission(() => auth(), permissionConfig)

// Usage
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

**Problems:**
- Requires creating factory functions before use
- Configuration is scattered (auth function + config passed separately)
- Not consistent with client-side Context Provider pattern
- Extra boilerplate in every project

## Proposed Solution: Module-Level Configuration

### Pattern: Configuration Function + Direct Exports

Similar to how libraries like `next-auth` work - configure once, use directly.

### Proposed API

**1. Configuration Function:**
```typescript
// src/lib/auth-permissions.ts
import { configurePermissions } from "@raburski/next-auth-permissions/server"
import { auth } from "@/server/auth"
import { permissionConfig } from "./permissions"

// Configure once at module level
configurePermissions({
	auth: () => auth(),
	...permissionConfig,
})
```

**2. Direct Middleware Exports:**
```typescript
// In API routes - use directly, no factory needed
import { withAuth, withPermission } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"

export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
export const GET = withAuth(handler)
```

**3. Direct Utility Functions:**
```typescript
// Direct usage in route handlers
import { requireAuth, requireUserCan } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"

const { session, error } = await requireAuth()
const { session, error } = await requireUserCan(Permission.BUILDINGS_EDIT)
```

## Implementation Approach

### Option 1: Module-Level State (Recommended)

Store configuration in module-level variables:

```typescript
// src/server/config.ts
let authFn: (() => Promise<Session | null>) | null = null
let permissionConfig: PermissionConfig<any, any, any> | null = null

export function configurePermissions<
	Permission extends string,
	Role extends string,
	UserStatus extends string = string
>(config: {
	auth: () => Promise<Session | null>
} & PermissionConfig<Permission, Role, UserStatus>) {
	authFn = config.auth
	permissionConfig = {
		rolePermissions: config.rolePermissions,
		isUserActive: config.isUserActive,
		activeStatus: config.activeStatus,
		messages: config.messages,
	}
}

export function getAuth() {
	if (!authFn) {
		throw new Error("Permissions not configured. Call configurePermissions() first.")
	}
	return authFn
}

export function getPermissionConfig() {
	if (!permissionConfig) {
		throw new Error("Permissions not configured. Call configurePermissions() first.")
	}
	return permissionConfig
}
```

**Middleware:**
```typescript
// src/server/middleware.ts
export const withAuth: Middleware = <T>(handler: APIHandler<T>): APIHandler<T> => {
	return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
		const { session: validatedSession, error } = await requireAuth(getAuth())
		// ... rest of implementation
	}
}

export function withPermission<Permission extends string>(
	permission: Permission
): Middleware {
	return <T>(handler: APIHandler<T>): APIHandler<T> => {
		return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
			const { session: validatedSession, error } = await requireUserCan(
				permission,
				getAuth(),
				getPermissionConfig()
			)
			// ... rest of implementation
		}
	}
}
```

**Utilities:**
```typescript
// src/server/authUtils.ts
export async function requireAuth<TSession extends SessionWithRole = SessionWithRole>(): Promise<AuthResult<TSession>> {
	return requireAuthInternal<TSession>(getAuth())
}

export async function requireUserCan<
	Permission extends string,
	Role extends string,
	UserStatus extends string = string,
	TSession extends SessionWithRole = SessionWithRole
>(permission: Permission): Promise<AuthResult<TSession>> {
	return requireUserCanInternal<Permission, Role, UserStatus, TSession>(
		permission,
		getAuth(),
		getPermissionConfig()
	)
}
```

### Option 2: Singleton Class

Use a singleton pattern:

```typescript
class PermissionsConfig {
	private authFn: (() => Promise<Session | null>) | null = null
	private config: PermissionConfig<any, any, any> | null = null

	configure<Permission extends string, Role extends string, UserStatus extends string = string>(
		config: { auth: () => Promise<Session | null> } & PermissionConfig<Permission, Role, UserStatus>
	) {
		this.authFn = config.auth
		this.config = { ...config }
	}

	getAuth() {
		if (!this.authFn) throw new Error("Not configured")
		return this.authFn
	}

	getConfig() {
		if (!this.config) throw new Error("Not configured")
		return this.config
	}
}

export const permissionsConfig = new PermissionsConfig()
```

### Option 3: AsyncLocalStorage (Advanced)

For multi-tenant scenarios, use AsyncLocalStorage to store config per request:

```typescript
import { AsyncLocalStorage } from "async_hooks"

const configStorage = new AsyncLocalStorage<{
	auth: () => Promise<Session | null>
	config: PermissionConfig<any, any, any>
}>()

// This would require wrapping requests, more complex
```

## Recommended: Option 1 (Module-Level State)

**Pros:**
- ✅ Simple and straightforward
- ✅ No factory functions needed
- ✅ Consistent with client-side pattern (configure once, use everywhere)
- ✅ Clean API - direct imports
- ✅ Type-safe with proper error messages
- ✅ Similar to how NextAuth and other libraries work

**Cons:**
- ⚠️ Module-level state (but acceptable for server-side config)
- ⚠️ Must configure before use (but enforced with clear error)

## Migration Path

**Before:**
```typescript
// Setup
const withAuth = createWithAuth(() => auth())
const withPermission = createWithPermission(() => auth(), permissionConfig)

// Usage
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

**After:**
```typescript
// Setup (once, in a config file)
configurePermissions({
	auth: () => auth(),
	...permissionConfig,
})

// Usage (direct, no factory)
import { withAuth, withPermission } from "@raburski/next-auth-permissions/server"
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

## Type Safety

The configuration would be typed, but the middleware would need to work with generic permissions:

```typescript
// Configuration captures types
configurePermissions<Permission, UserRole, UserStatus>({
	auth: () => auth(),
	rolePermissions: ROLE_PERMISSIONS,
	activeStatus: UserStatus.ACTIVE,
})

// Middleware uses inferred types from config
export function withPermission(permission: Permission): Middleware {
	// Types are inferred from the configured Permission type
}
```

**Challenge:** TypeScript can't easily infer types from module-level state. We might need:
- Type assertions in middleware
- Or accept that permission types are checked at runtime
- Or use a different approach with type parameters

## Alternative: Hybrid Approach

Keep factory functions but make them optional - if configured, use direct exports:

```typescript
// If configured, use direct
configurePermissions({ auth, ...config })
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)

// If not configured, use factory (backward compatible)
const withPermission = createWithPermission(() => auth(), config)
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

## Recommendation

**Go with Option 1 (Module-Level State)** because:
1. Simplest to implement and understand
2. Most consistent with client-side Context Provider pattern
3. Clean API - no factory functions needed
4. Clear error messages if not configured
5. Similar to established patterns (NextAuth, etc.)

The type safety challenge can be addressed by:
- Runtime type checking
- Or accepting that Permission types are project-specific and checked at usage time
- Or using a type assertion helper

## Questions to Consider

1. **Type Safety**: How important is compile-time type checking for permissions? Runtime checking might be acceptable.

2. **Multiple Configurations**: Do we need to support different configs per route? (Probably not for most use cases)

3. **Backward Compatibility**: Should we keep factory functions as an alternative? (Probably not needed if we document the new pattern)

4. **Testing**: How to handle testing scenarios where config might differ? (Could provide a `resetConfig()` function for tests)

