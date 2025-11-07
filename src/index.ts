// Core permission utilities
export { userCan, userCanAny, userCanAll } from "./permissions"

// Server-side utilities
export { configurePermissions, resetConfig } from "./server/config"
export { requireAuth, requireUserCan, type AuthResult } from "./server/authUtils"
export { withAuth, withPermission, withCustomPermission } from "./server/middleware"
export { checkPermission, checkOwnership, checkResourceState } from "./server/helpers"

// Client-side hooks and provider (re-exported for convenience)
export {
	PermissionsProvider,
	useUserCan,
	useUserCanAny,
	useUserCanAll,
	useRequireAuthenticatedUser,
	useRequireUserCan,
} from "./client"
export type { PermissionsProviderProps, PermissionsContextValue } from "./client"

// Re-export types from next-api-middleware
export type { APIContext, APIHandler, Middleware } from "@raburski/next-api-middleware"

// Permission-specific types
export type {
	PermissionConfig,
	SessionWithRole,
} from "./types"

