# Custom Resource-Based Permissions Proposal

## Problem

The current package handles role-based permissions well, but many applications need **resource-based permissions** where:
- Ownership matters (user owns the resource)
- Resource state matters (e.g., DRAFT status allows owner editing)
- Custom business logic (e.g., "can edit if owner AND status is DRAFT")

Example: `withBuildingEditPermission` allows editing if:
1. User has `BUILDINGS_EDIT` permission (role-based), OR
2. Building is `DRAFT` AND user is the owner (resource-based)

## Current Implementation

```typescript
// Current custom middleware
export const withBuildingEditPermission: Middleware = <T>(
	handler: APIHandler<T>
): APIHandler<T> => {
	return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
		const { session, error } = await requireAuth()
		if (error) return error

		const building = context.resource as Building
		const hasEditPermission = userCan(session.user.role, Permission.BUILDINGS_EDIT)
		const isOwner = building.submittedByUserId === session.user.id
		const isDraft = building.status === BuildingStatus.DRAFT

		if (!hasEditPermission && !(isDraft && isOwner)) {
			return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 })
		}

		return handler(request, { ...context, session })
	}
}
```

## Proposed Solutions

### Option 1: Custom Permission Checker Function (Recommended)

Add a `withCustomPermission` middleware that accepts a custom checker function.

**API:**
```typescript
withCustomPermission(
	checker: (session: Session, context: APIContext) => boolean | Promise<boolean>,
	options?: {
		errorMessage?: string
		errorStatus?: number
	}
): Middleware
```

**Usage:**
```typescript
import { withCustomPermission, requireAuth } from "@raburski/next-auth-permissions/server"
import { userCan } from "@raburski/next-auth-permissions"
import { Permission, BuildingStatus } from "@/lib/permissions"

export const withBuildingEditPermission = withCustomPermission(
	async (session, context) => {
		const building = context.resource as Building
		
		// Standard permission check
		const hasEditPermission = userCan(
			session.user.role, 
			Permission.BUILDINGS_EDIT,
			getPermissionConfig().rolePermissions
		)
		if (hasEditPermission) return true
		
		// Resource-based check
		const isOwner = building.submittedByUserId === session.user.id
		const isDraft = building.status === BuildingStatus.DRAFT
		return isDraft && isOwner
	},
	{
		errorMessage: "Insufficient permissions to edit this building",
		errorStatus: 403,
	}
)

// Usage
export const PATCH = compose(
	withBuildingExists,
	withBuildingEditPermission
)(updateBuilding)
```

**Pros:**
- ✅ Flexible - can handle any custom logic
- ✅ Composable with other middleware
- ✅ Type-safe with context
- ✅ Can be async for database checks
- ✅ Clear separation of concerns

**Cons:**
- ⚠️ Requires accessing config (could be improved)
- ⚠️ Slightly more verbose than dedicated middleware

---

### Option 2: Resource Permission Builder

Create a builder pattern for common resource-based permission patterns.

**API:**
```typescript
withResourcePermission({
	permission?: Permission,  // Optional base permission
	checkOwnership?: (resource: T, session: Session) => boolean,
	checkState?: (resource: T) => boolean,
	checkCustom?: (resource: T, session: Session) => boolean | Promise<boolean>,
	combineWith?: "OR" | "AND",  // How to combine checks
}): Middleware
```

**Usage:**
```typescript
import { withResourcePermission } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"

export const withBuildingEditPermission = withResourcePermission({
	permission: Permission.BUILDINGS_EDIT,  // Base permission
	checkOwnership: (building, session) => 
		building.submittedByUserId === session.user.id,
	checkState: (building) => 
		building.status === BuildingStatus.DRAFT,
	combineWith: "OR",  // permission OR (owner AND draft)
})

// Usage
export const PATCH = compose(
	withBuildingExists,
	withBuildingEditPermission
)(updateBuilding)
```

**Pros:**
- ✅ Covers common patterns (ownership + state)
- ✅ Declarative and readable
- ✅ Type-safe

**Cons:**
- ⚠️ Less flexible for complex logic
- ⚠️ Might not cover all edge cases
- ⚠️ More API surface to maintain

---

### Option 3: Permission Extensions / Hooks

Allow extending the permission system with custom checkers that can be registered.

**API:**
```typescript
// Register custom permission checker
registerPermissionChecker(
	"BUILDINGS_EDIT",
	async (session, context) => {
		const building = context.resource as Building
		// Custom logic here
		return hasEditPermission || (isDraft && isOwner)
	}
)

// Then use standard withPermission
export const PATCH = compose(
	withBuildingExists,
	withPermission(Permission.BUILDINGS_EDIT)  // Uses registered checker
)(updateBuilding)
```

**Pros:**
- ✅ Reuses existing `withPermission` API
- ✅ Centralized permission logic
- ✅ Can override default behavior

**Cons:**
- ⚠️ Global state (might conflict in multi-tenant)
- ⚠️ Less explicit - harder to see custom logic
- ⚠️ More complex implementation

---

### Option 4: Composable Permission Helpers

Provide helper functions that can be used in custom middleware.

**API:**
```typescript
// Helper functions
export function checkPermission(session: Session, permission: Permission): boolean
export function checkOwnership(resource: { submittedByUserId?: string }, session: Session): boolean
export function checkResourceState<T>(resource: T, predicate: (r: T) => boolean): boolean

// Custom middleware using helpers
export const withBuildingEditPermission: Middleware = <T>(
	handler: APIHandler<T>
): APIHandler<T> => {
	return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
		const { session, error } = await requireAuth()
		if (error) return error

		const building = context.resource as Building
		
		const canEdit = 
			checkPermission(session, Permission.BUILDINGS_EDIT) ||
			(checkOwnership(building, session) && 
			 checkResourceState(building, b => b.status === BuildingStatus.DRAFT))

		if (!canEdit) {
			return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 })
		}

		return handler(request, { ...context, session })
	}
}
```

**Pros:**
- ✅ Flexible - full control
- ✅ Reusable helpers
- ✅ No new middleware needed
- ✅ Easy to understand

**Cons:**
- ⚠️ More boilerplate
- ⚠️ Not as declarative
- ⚠️ Each project writes their own middleware

---

## Recommended: Hybrid Approach (Option 1 + Option 4)

Combine `withCustomPermission` middleware with helper functions for maximum flexibility and convenience.

### Implementation

**1. Add helper functions:**
```typescript
// src/server/helpers.ts
export function checkPermission<Permission extends string, Role extends string>(
	session: SessionWithRole,
	permission: Permission
): boolean {
	const config = getPermissionConfig<Permission, Role>()
	return userCan(session.user.role as Role, permission, config.rolePermissions)
}

export function checkOwnership(
	resource: { submittedByUserId?: string | null },
	session: SessionWithRole
): boolean {
	return resource.submittedByUserId === session.user.id
}

export function checkResourceState<T>(
	resource: T,
	predicate: (resource: T) => boolean
): boolean {
	return predicate(resource)
}
```

**2. Add `withCustomPermission` middleware:**
```typescript
// src/server/middleware.ts
export function withCustomPermission(
	checker: (
		session: SessionWithRole,
		context: APIContext
	) => boolean | Promise<boolean>,
	options?: {
		errorMessage?: string
		errorStatus?: number
	}
): Middleware {
	return <T>(handler: APIHandler<T>): APIHandler<T> => {
		return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
			const { session, error } = await requireAuth()
			if (error) return error

			const canAccess = await checker(session, context)
			if (!canAccess) {
				return NextResponse.json(
					{ message: options?.errorMessage || "Insufficient permissions" },
					{ status: options?.errorStatus || 403 }
				)
			}

			const newContext: APIContext<T> = {
				...context,
				session,
			}

			return handler(request, newContext)
		}
	}
}
```

**3. Usage Example:**
```typescript
// src/lib/middleware/building.ts
import { 
	withCustomPermission, 
	checkPermission, 
	checkOwnership,
	checkResourceState 
} from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"
import { BuildingStatus } from "@/types"

export const withBuildingEditPermission = withCustomPermission(
	async (session, context) => {
		const building = context.resource as Building
		if (!building) return false

		// Standard permission OR (owner AND draft)
		return (
			checkPermission(session, Permission.BUILDINGS_EDIT) ||
			(checkOwnership(building, session) && 
			 checkResourceState(building, b => b.status === BuildingStatus.DRAFT))
		)
	},
	{
		errorMessage: "You don't have permission to edit this building",
	}
)
```

**4. Alternative - Manual Implementation:**
```typescript
// If you prefer full control, use helpers in your own middleware
export const withBuildingEditPermission: Middleware = <T>(
	handler: APIHandler<T>
): APIHandler<T> => {
	return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
		const { session, error } = await requireAuth()
		if (error) return error

		const building = context.resource as Building
		if (!building) {
			return NextResponse.json({ message: "Building not found" }, { status: 404 })
		}

		const canEdit = 
			checkPermission(session, Permission.BUILDINGS_EDIT) ||
			(checkOwnership(building, session) && 
			 checkResourceState(building, b => b.status === BuildingStatus.DRAFT))

		if (!canEdit) {
			return NextResponse.json({ message: "Insufficient permissions" }, { status: 403 })
		}

		return handler(request, { ...context, session })
	}
}
```

## Benefits of Recommended Approach

1. **Flexibility**: `withCustomPermission` handles any custom logic
2. **Convenience**: Helper functions for common patterns
3. **Composability**: Works with existing middleware
4. **Type Safety**: Full TypeScript support
5. **Reusability**: Helpers can be used in multiple places
6. **Explicitness**: Clear what the custom logic does

## Additional Considerations

### Client-Side Support

For client-side hooks, we could add similar helpers:

```typescript
// Client-side
export function useCanEditResource<T>(
	resource: T | null | undefined,
	permission: Permission,
	checks: {
		checkOwnership?: (resource: T, session: SessionWithRole) => boolean
		checkState?: (resource: T) => boolean
	}
): boolean {
	const hasPermission = useUserCan(permission)
	if (hasPermission) return true

	if (!resource) return false

	const isOwner = checks.checkOwnership?.(resource, session) ?? false
	const stateCheck = checks.checkState?.(resource) ?? true

	return isOwner && stateCheck
}

// Usage
const canEdit = useCanEditResource(building, Permission.BUILDINGS_EDIT, {
	checkOwnership: (b, s) => b.submittedByUserId === s.user.id,
	checkState: (b) => b.status === BuildingStatus.DRAFT,
})
```

### Testing

Helper functions are easy to test:
```typescript
describe("checkOwnership", () => {
	it("returns true when user owns resource", () => {
		const resource = { submittedByUserId: "user-1" }
		const session = { user: { id: "user-1" } }
		expect(checkOwnership(resource, session)).toBe(true)
	})
})
```

## Migration Path

1. Add helper functions to package
2. Add `withCustomPermission` middleware
3. Update project to use new helpers
4. Gradually migrate custom middleware

## Questions

1. Should we include common helpers in the package, or keep it minimal?
2. Do we need client-side helpers too?
3. Should `withCustomPermission` support async checkers? (Yes, recommended)
4. Should we provide TypeScript utilities for extracting resource types from context?

