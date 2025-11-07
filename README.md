# @raburski/next-auth-permissions

A generic, type-safe permission system for Next.js applications using NextAuth.js v5. This package provides server-side middleware, client-side hooks, and utilities for role-based access control (RBAC).

## Features

- ✅ **Type-safe**: Full TypeScript support with generics
- ✅ **Generic**: Works with any permission and role types
- ✅ **Flexible**: Configurable user status checks
- ✅ **NextAuth.js v5**: Built for NextAuth.js v5 (beta)
- ✅ **Server & Client**: Utilities for both server and client components
- ✅ **Middleware**: Composable middleware for API routes
- ✅ **Hooks**: React hooks for client-side permission checks
- ✅ **Custom Permissions**: Support for resource-based and custom permission logic

## Installation

```bash
npm install @raburski/next-auth-permissions
```

## Quick Start

### 1. Define Your Permissions and Roles

```typescript
// src/lib/permissions.ts
export enum Permission {
	BUILDINGS_ADD = "buildings.add",
	BUILDINGS_EDIT = "buildings.edit",
	BUILDINGS_DELETE = "buildings.delete",
	COMMENTS_ADD = "comments.add",
	COMMENTS_DELETE = "comments.delete",
}

export enum UserRole {
	USER = "USER",
	MODERATOR = "MODERATOR",
	ADMIN = "ADMIN",
}

export enum UserStatus {
	ACTIVE = "ACTIVE",
	BANNED = "BANNED",
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
	[UserRole.USER]: [
		Permission.BUILDINGS_ADD,
		Permission.COMMENTS_ADD,
	],
	[UserRole.MODERATOR]: [
		Permission.BUILDINGS_ADD,
		Permission.COMMENTS_ADD,
		Permission.BUILDINGS_EDIT,
		Permission.COMMENTS_DELETE,
	],
	[UserRole.ADMIN]: [
		Permission.BUILDINGS_ADD,
		Permission.COMMENTS_ADD,
		Permission.BUILDINGS_EDIT,
		Permission.BUILDINGS_DELETE,
		Permission.COMMENTS_DELETE,
	],
}
```

### 2. Configure Server-Side Utilities

```typescript
// src/lib/auth-permissions.ts
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

### 3. Use in API Routes

```typescript
// src/app/api/buildings/route.ts
import { NextRequest, NextResponse } from "next/server"
import { withPermission } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"
import { APIHandler } from "@raburski/next-auth-permissions"

const createBuilding: APIHandler = async (request, context) => {
	const { session } = context
	// session is guaranteed to be authenticated and have the required permission
	// ... your logic here
	return NextResponse.json({ success: true })
}

export const POST = withPermission(Permission.BUILDINGS_ADD)(createBuilding)
```

### 4. Wrap Your App with PermissionsProvider

```typescript
// src/app/layout.tsx or src/app/providers.tsx
import { PermissionsProvider } from "@raburski/next-auth-permissions/client"
import { ROLE_PERMISSIONS } from "@/lib/permissions"

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<PermissionsProvider 
			rolePermissions={ROLE_PERMISSIONS}
			signinPath="/login"  // Optional: defaults to "/signin"
			defaultRedirectTo="/dashboard"  // Optional: defaults to "/"
		>
			{children}
		</PermissionsProvider>
	)
}
```

### 5. Use in Components

```typescript
// src/components/BuildingForm.tsx
"use client"

import { useUserCan } from "@raburski/next-auth-permissions/client"
import { Permission } from "@/lib/permissions"

export function BuildingForm() {
	const canEdit = useUserCan(Permission.BUILDINGS_EDIT)
	
	return (
		<div>
			{canEdit && <button>Edit Building</button>}
		</div>
	)
}
```

## API Reference

### Server-Side

#### `configurePermissions(config)`

Configure the permissions system. Must be called once before using any middleware or utilities.

```typescript
import { configurePermissions } from "@raburski/next-auth-permissions/server"

configurePermissions({
	auth: () => auth(),
	rolePermissions: ROLE_PERMISSIONS,
	activeStatus: UserStatus.ACTIVE,
})
```

#### `withAuth`

Authentication middleware that ensures a user is logged in. Uses the configured auth function.

```typescript
import { withAuth } from "@raburski/next-auth-permissions/server"

export const GET = withAuth(handler)
```

#### `withPermission(permission)`

Permission middleware that ensures user has the required permission. Uses the configured auth and config.

```typescript
import { withPermission } from "@raburski/next-auth-permissions/server"

export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

#### `requireAuth()`

Directly check if user is authenticated. Returns `{ session, error }`. Uses the configured auth function.

```typescript
import { requireAuth } from "@raburski/next-auth-permissions/server"

const { session, error } = await requireAuth()
if (error) return error
```

#### `requireUserCan(permission)`

Directly check if user has a permission. Returns `{ session, error }`. Uses the configured auth and config.

```typescript
import { requireUserCan } from "@raburski/next-auth-permissions/server"

const { session, error } = await requireUserCan(Permission.BUILDINGS_EDIT)
if (error) return error
```

#### `withCustomPermission(checker, options?)`

Custom permission middleware that allows you to implement custom permission checking logic. Useful for resource-based permissions (e.g., ownership checks, state-based permissions).

The checker function receives `session`, `context`, and `request` as parameters, allowing you to:
- Check permissions based on session
- Access resources from context
- Read request body or headers if needed

```typescript
import { withCustomPermission, checkPermission, checkOwnership, checkResourceState } from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"

// Simple example - no request body needed
const withBuildingEditPermission = withCustomPermission(
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

// Advanced example - with request body access
const withBuildingStatusChangePermission = withCustomPermission(
	async (session, context, request) => {
		const building = context.resource as Building
		if (!building) return false

		const hasApprovePermission = checkPermission(session, Permission.BUILDINGS_APPROVE)
		if (hasApprovePermission) return true

		// Read request body to check target status
		// Note: The request is already cloned by withCustomPermission, safe to read
		const body = await request.json()
		const targetStatus = body.status

		const isOwner = checkOwnership(building, session)
		const isDraft = checkResourceState(building, b => b.status === BuildingStatus.DRAFT)
		const isSubmittingDraft = isDraft && targetStatus === BuildingStatus.SUBMITTED

		return isOwner && isSubmittingDraft
	},
	{
		errorMessage: "You don't have permission to change this building's status",
	}
)

export const PATCH = compose(
	withBuildingExists,
	withBuildingEditPermission
)(updateBuilding)
```

#### Helper Functions

**`checkPermission(session, permission)`**

Check if a session has a specific permission using the configured permission config.

```typescript
import { checkPermission } from "@raburski/next-auth-permissions/server"

const canEdit = checkPermission(session, Permission.BUILDINGS_EDIT)
```

**`checkOwnership(resource, session)`**

Check if a user owns a resource. Supports multiple ownership field names:
- `submittedByUserId`
- `userId`
- `ownerId`

```typescript
import { checkOwnership } from "@raburski/next-auth-permissions/server"

const isOwner = checkOwnership(building, session)
```

**`checkResourceState(resource, predicate)`**

Check if a resource matches a state predicate.

```typescript
import { checkResourceState } from "@raburski/next-auth-permissions/server"

const isDraft = checkResourceState(building, b => b.status === BuildingStatus.DRAFT)
```

#### `resetConfig()`

Reset the configuration (useful for testing).

```typescript
import { resetConfig } from "@raburski/next-auth-permissions/server"

resetConfig()
```

### Client-Side

#### `PermissionsProvider`

Provider component that wraps your app to provide permission configuration.

```typescript
<PermissionsProvider 
	rolePermissions={ROLE_PERMISSIONS}
	signinPath="/login"  // Optional: path to redirect when not authenticated (default: "/signin")
	defaultRedirectTo="/dashboard"  // Optional: default redirect when permission denied (default: "/")
>
	<App />
</PermissionsProvider>
```

#### `useUserCan(permission)`

Hook to check if user has a permission. Must be used within `PermissionsProvider`.

```typescript
const canEdit = useUserCan(Permission.BUILDINGS_EDIT)
```

#### `useUserCanAny(permissions)`

Hook to check if user has any of the specified permissions.

```typescript
const canModify = useUserCanAny([Permission.BUILDINGS_EDIT, Permission.BUILDINGS_DELETE])
```

#### `useUserCanAll(permissions)`

Hook to check if user has all of the specified permissions.

```typescript
const canManage = useUserCanAll([Permission.BUILDINGS_EDIT, Permission.COMMENTS_DELETE])
```

#### `useRequireUserCan(permission, redirectTo?)`

Hook that redirects if user doesn't have permission.

```typescript
const { session, hasPermission } = useRequireUserCan(Permission.ADMIN_DASHBOARD)
```

#### `useRequireAuthenticatedUser(redirectTo?)`

Hook that redirects to signin if not authenticated.

```typescript
const { session, isLoading } = useRequireAuthenticatedUser()
```

### Core Utilities

#### `userCan(role, permission, rolePermissions)`

Check if a role has a permission.

```typescript
const canEdit = userCan(UserRole.ADMIN, Permission.BUILDINGS_EDIT, ROLE_PERMISSIONS)
```

#### `userCanAny(role, permissions, rolePermissions)`

Check if a role has any of the permissions.

```typescript
const canModify = userCanAny(UserRole.MODERATOR, [Permission.BUILDINGS_EDIT, Permission.BUILDINGS_DELETE], ROLE_PERMISSIONS)
```

#### `userCanAll(role, permissions, rolePermissions)`

Check if a role has all of the permissions.

```typescript
const canManage = userCanAll(UserRole.ADMIN, [Permission.BUILDINGS_EDIT, Permission.BUILDINGS_DELETE], ROLE_PERMISSIONS)
```

## Configuration

### PermissionConfig

```typescript
type PermissionConfig<Permission, Role, UserStatus> = {
	rolePermissions: Record<Role, Permission[]>
	isUserActive?: (user: { status?: UserStatus }) => boolean
	activeStatus?: UserStatus
	messages?: {
		unauthorized?: string
		banned?: string
		insufficientPermissions?: string
	}
}
```

### Custom User Status Check

You can provide a custom function to check if a user is active:

```typescript
const permissionConfig = {
	rolePermissions: ROLE_PERMISSIONS,
	isUserActive: (user) => {
		return user.status === UserStatus.ACTIVE && !user.deleted
	},
}
```

Or use the simpler `activeStatus` option:

```typescript
const permissionConfig = {
	rolePermissions: ROLE_PERMISSIONS,
	activeStatus: UserStatus.ACTIVE,
}
```

## Custom Resource-Based Permissions

For cases where you need custom permission logic (e.g., ownership checks, state-based permissions), use `withCustomPermission` with helper functions:

```typescript
import { 
	withCustomPermission, 
	checkPermission, 
	checkOwnership,
	checkResourceState 
} from "@raburski/next-auth-permissions/server"
import { Permission } from "@/lib/permissions"
import { BuildingStatus } from "@/types"

// Example: Allow editing if user has permission OR owns a draft building
export const withBuildingEditPermission = withCustomPermission(
	async (session, context) => {
		const building = context.resource as Building
		if (!building) return false

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

// Use with other middleware
import { compose } from "@/lib/middleware/compose"

export const PATCH = compose(
	withBuildingExists,
	withBuildingEditPermission
)(updateBuilding)
```

The helper functions make it easy to combine standard permissions with resource-based checks:
- `checkPermission(session, permission)` - Check role-based permission
- `checkOwnership(resource, session)` - Check if user owns resource (supports `submittedByUserId`, `userId`, `ownerId`)
- `checkResourceState(resource, predicate)` - Check resource state with a predicate function

## TypeScript

The package is fully typed. Make sure to extend NextAuth types:

```typescript
// src/server/auth/config.ts
declare module "next-auth" {
	interface Session {
		user: {
			id: string
			role: string
			status?: string
		}
	}
}
```

## Migration from Internal Implementation

If you're migrating from an internal implementation:

1. Replace `requireAuth` and `requireUserCan` imports
2. Replace `withAuth` and `withPermission` with the factory functions
3. Replace hooks with the factory-created hooks
4. Update types to use the package types

## License

MIT

