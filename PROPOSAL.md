# Package Proposal: @raburski/next-auth-permissions

## Overview

This package extracts the permission system from the vernacular-map project into a generic, reusable package that can be used across multiple Next.js projects with NextAuth.js v5.

## Architecture

### Core Design Principles

1. **Generic & Type-Safe**: Uses TypeScript generics to work with any permission and role types
2. **Framework Agnostic**: Core utilities don't depend on Next.js or NextAuth (except for hooks/middleware)
3. **Configurable**: Flexible configuration for user status checks and error messages
4. **Composable**: Middleware can be composed together
5. **Server/Client Split**: Clear separation between server and client code

### Package Structure

```
packages/next-auth-permissions/
├── src/
│   ├── index.ts              # Main exports
│   ├── types.ts              # Shared types
│   ├── permissions.ts       # Core permission utilities (framework-agnostic)
│   ├── server/
│   │   ├── authUtils.ts      # Server-side auth utilities
│   │   ├── middleware.ts     # Middleware factories
│   │   └── index.ts          # Server exports
│   └── client/
│       ├── hooks.ts          # React hooks factories
│       └── index.ts          # Client exports
├── package.json
├── tsconfig.json
├── README.md
└── MIGRATION.md
```

## Key Features

### 1. Core Permission Utilities

Framework-agnostic functions that work with any permission/role system:

- `userCan(role, permission, rolePermissions)` - Check single permission
- `userCanAny(role, permissions, rolePermissions)` - Check if has any permission
- `userCanAll(role, permissions, rolePermissions)` - Check if has all permissions

### 2. Server-Side Utilities

**Factory Functions** (recommended approach):
- `createWithAuth(auth)` - Creates authentication middleware
- `createWithPermission(auth, config)` - Creates permission middleware factory

**Direct Functions**:
- `requireAuth(auth)` - Check authentication
- `requireUserCan(permission, auth, config)` - Check permission

### 3. Client-Side Hooks

**Context Provider**:
- `PermissionsProvider` - Provider component that wraps your app
- `usePermissionsContext()` - Internal hook to access context

**Hooks** (must be used within `PermissionsProvider`):
- `useUserCan(permission)` - Check if user has a permission
- `useUserCanAny(permissions)` - Check if user has any permission
- `useUserCanAll(permissions)` - Check if user has all permissions
- `useRequireUserCan(permission, redirectTo?)` - Require permission with redirect
- `useRequireAuthenticatedUser(redirectTo?)` - Require authentication

### 4. Configuration

The `PermissionConfig` type allows flexible configuration:

```typescript
type PermissionConfig<Permission, Role, UserStatus> = {
	rolePermissions: Record<Role, Permission[]>
	isUserActive?: (user) => boolean  // Custom active check
	activeStatus?: UserStatus          // Simple active status check
	messages?: {
		unauthorized?: string
		banned?: string
		insufficientPermissions?: string
	}
}
```

## Usage Pattern

### Step 1: Define Permissions & Roles

```typescript
// src/lib/permissions.ts
export enum Permission { ... }
export enum UserRole { ... }
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = { ... }
```

### Step 2: Create Configuration

```typescript
// src/lib/auth-permissions.ts
import { createWithAuth, createWithPermission } from "@raburski/next-auth-permissions/server"

export const permissionConfig = {
	rolePermissions: ROLE_PERMISSIONS,
	activeStatus: UserStatus.ACTIVE,
}

export const withAuth = createWithAuth(() => auth())
export const withPermission = createWithPermission(() => auth(), permissionConfig)
```

### Step 3: Use in API Routes

```typescript
export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
```

### Step 4: Wrap App with PermissionsProvider

```typescript
// src/app/layout.tsx or src/app/providers.tsx
import { PermissionsProvider } from "@raburski/next-auth-permissions/client"

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<PermissionsProvider rolePermissions={ROLE_PERMISSIONS}>
			{children}
		</PermissionsProvider>
	)
}
```

### Step 5: Use Hooks Directly

```typescript
// No wrapper needed - import directly!
import { useUserCan } from "@raburski/next-auth-permissions/client"
```

## Benefits

1. **Reusability**: Can be used in any Next.js + NextAuth project
2. **Type Safety**: Full TypeScript support with generics
3. **Flexibility**: Configurable for different use cases
4. **Maintainability**: Single source of truth for permission logic
5. **Testability**: Core utilities are framework-agnostic and easy to test
6. **React Idiomatic**: Uses Context Provider pattern, standard React approach
7. **Clean API**: Hooks can be used directly without factory functions

## Migration Path

The package is designed to be a drop-in replacement with minimal changes:

1. Install package
2. Create configuration file
3. Update imports
4. Remove old files

See `MIGRATION.md` for detailed steps.

## Future Enhancements

Potential additions (not in initial version):

- Resource-based permissions (e.g., "can edit own building")
- Permission caching
- Permission inheritance/groups
- Audit logging hooks
- Permission testing utilities

## Dependencies

- **Peer Dependencies**: `next`, `next-auth`, `react`
- **No Runtime Dependencies**: Core utilities are pure functions
- **Dev Dependencies**: TypeScript, type definitions

## Publishing

The package can be published to npm as `@raburski/next-auth-permissions` and used in any project via:

```bash
npm install @raburski/next-auth-permissions
```

