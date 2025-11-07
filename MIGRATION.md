# Migration Guide

This guide shows how to migrate from the internal permission system to `@raburski/next-auth-permissions`.

## Step 1: Install the Package

```bash
npm install @raburski/next-auth-permissions
```

## Step 2: Configure Permissions

Create a new file `src/lib/auth-permissions.ts`:

```typescript
import { auth } from "@/server/auth"
import { configurePermissions } from "@raburski/next-auth-permissions/server"
import { Permission, UserRole, UserStatus, ROLE_PERMISSIONS } from "./permissions"

// Configure once - this sets up the auth function and permission config
configurePermissions({
	auth: () => auth(),
	rolePermissions: ROLE_PERMISSIONS,
	activeStatus: UserStatus.ACTIVE,
	messages: {
		unauthorized: "Unauthorized",
		banned: "Your account has been banned",
		insufficientPermissions: "Insufficient permissions",
	},
})
```

## Step 3: Update Server-Side Utilities

### Before (src/lib/authUtils.ts)

```typescript
import { requireUserCan, requireAuth } from "@/lib/authUtils"

const { session, error } = await requireAuth()
const { session, error } = await requireUserCan(Permission.BUILDINGS_EDIT)
```

### After

```typescript
import { requireUserCan, requireAuth } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"

// No need to pass auth or config - uses configured values
const { session, error } = await requireAuth()
const { session, error } = await requireUserCan(Permission.BUILDINGS_EDIT)
```

## Step 4: Update Middleware

### Before (src/lib/middleware/permissions.ts)

```typescript
import { withAuth, withPermission } from "@/lib/middleware/permissions"
```

### After

```typescript
import { withAuth, withPermission } from "@raburski/next-auth-permissions/server"
```

The middleware API remains the same:

```typescript
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

**Note:** Make sure you've called `configurePermissions()` before using the middleware, otherwise you'll get a clear error message.

## Step 5: Add PermissionsProvider

Wrap your app with the `PermissionsProvider`:

```typescript
// src/app/layout.tsx or src/app/providers.tsx
import { PermissionsProvider } from "@raburski/next-auth-permissions/client"
import { ROLE_PERMISSIONS } from "@/lib/permissions"

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<PermissionsProvider 
			rolePermissions={ROLE_PERMISSIONS}
			signinPath="/signin"  // Optional: customize signin path (default: "/signin")
			defaultRedirectTo="/"  // Optional: customize default redirect (default: "/")
		>
			{children}
		</PermissionsProvider>
	)
}
```

## Step 6: Update Client-Side Hooks

### Before (src/hooks/auth/useUserCan.ts)

```typescript
import { useUserCan } from "@/hooks/auth/useUserCan"
```

### After

```typescript
// Direct import from package - no wrapper needed!
import { useUserCan } from "@raburski/next-auth-permissions/client"
```

The hooks work the same way, just import directly from the package.

## Step 7: Update Permission Utilities

### Before (src/lib/permissions.ts)

```typescript
export function userCan(userRole: string, permission: Permission): boolean {
	const permissions = ROLE_PERMISSIONS[userRole] || []
	return permissions.includes(permission)
}
```

### After

```typescript
import { userCan as baseUserCan } from "@raburski/next-auth-permissions"

export function userCan(userRole: UserRole, permission: Permission): boolean {
	return baseUserCan(userRole, permission, ROLE_PERMISSIONS)
}
```

Or use the package directly:

```typescript
import { userCan } from "@raburski/next-auth-permissions"
import { ROLE_PERMISSIONS } from "./permissions"

const canEdit = userCan(UserRole.ADMIN, Permission.BUILDINGS_EDIT, ROLE_PERMISSIONS)
```

## Step 8: Update Type Exports

The middleware types are now exported from the package:

```typescript
// Before
import { APIHandler, APIContext, Middleware } from "@/lib/middleware/types"

// After
import { APIHandler, APIContext, Middleware } from "@raburski/next-auth-permissions"
```

## Step 9: Remove Old Files

After migration, you can remove:

- `src/lib/authUtils.ts` (replaced by package)
- `src/lib/middleware/permissions.ts` (replaced by package)
- `src/hooks/auth/useUserCan.ts` (replaced by package hooks)
- `src/hooks/auth/useRequireUserCan.ts` (replaced by package hooks)
- `src/hooks/auth/useRequireAuthenticatedUser.ts` (replaced by package hook)

## Step 10: Update Exports (Optional)

If you have a hooks index file, you can re-export from the package:

```typescript
// src/hooks/auth/index.ts
export {
	useUserCan,
	useUserCanAny,
	useUserCanAll,
	useRequireUserCan,
	useRequireAuthenticatedUser,
} from "@raburski/next-auth-permissions/client"
```

Or just import directly from the package in your components.

## Complete Example

Here's a complete example of a migrated API route:

### Before

```typescript
import { NextRequest, NextResponse } from "next/server"
import { withPermission } from "@/lib/middleware/permissions"
import { Permission } from "@/lib/permissions"
import { APIHandler } from "@/lib/middleware/types"

const getUsers: APIHandler = async (request, context) => {
	const { session } = context
	// ... handler logic
}

export const GET = withPermission(Permission.USER_LIST_VIEW)(getUsers)
```

### After

```typescript
import { NextRequest, NextResponse } from "next/server"
import { withPermission } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"
import { APIHandler } from "@raburski/next-auth-permissions"

const getUsers: APIHandler = async (request, context) => {
	const { session } = context
	// ... handler logic (same as before)
}

export const GET = withPermission(Permission.USER_LIST_VIEW)(getUsers)
```

The API remains the same, just the imports change! Make sure `configurePermissions()` is called somewhere in your app initialization (e.g., in a config file that's imported early).

