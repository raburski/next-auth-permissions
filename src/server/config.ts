import "server-only"
import type { Session } from "next-auth"
import type { PermissionConfig } from "../types"

/**
 * Internal storage for auth function
 */
let authFn: (() => Promise<Session | null>) | null = null

/**
 * Internal storage for permission configuration
 */
let permissionConfig: PermissionConfig<any, any, any> | null = null

/**
 * Configure permissions system with auth function and permission config.
 * Must be called before using any middleware or utilities.
 * 
 * @example
 * ```typescript
 * import { configurePermissions } from "@raburski/next-auth-permissions/server"
 * import { auth } from "@/server/auth"
 * 
 * configurePermissions({
 *   auth: () => auth(),
 *   rolePermissions: ROLE_PERMISSIONS,
 *   activeStatus: UserStatus.ACTIVE,
 * })
 * ```
 */
export function configurePermissions<
	Permission extends string,
	Role extends string,
	UserStatus extends string = string
>(config: {
	auth: () => Promise<Session | null>
} & PermissionConfig<Permission, Role, UserStatus>): void {
	authFn = config.auth
	permissionConfig = {
		rolePermissions: config.rolePermissions,
		isUserActive: config.isUserActive,
		activeStatus: config.activeStatus,
		messages: config.messages,
	}
}

/**
 * Get the configured auth function
 * @throws Error if permissions not configured
 */
export function getAuth(): () => Promise<Session | null> {
	if (!authFn) {
		throw new Error(
			"Permissions not configured. Call configurePermissions() before using middleware or utilities."
		)
	}
	return authFn
}

/**
 * Get the configured permission config
 * @throws Error if permissions not configured
 */
export function getPermissionConfig<Permission extends string, Role extends string, UserStatus extends string = string>(): PermissionConfig<Permission, Role, UserStatus> {
	if (!permissionConfig) {
		throw new Error(
			"Permissions not configured. Call configurePermissions() before using middleware or utilities."
		)
	}
	return permissionConfig as PermissionConfig<Permission, Role, UserStatus>
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
	authFn = null
	permissionConfig = null
}

