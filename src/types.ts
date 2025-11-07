// Re-export types from next-api-middleware
export type { APIContext, APIHandler, Middleware } from "@raburski/next-api-middleware"

/**
 * Configuration for permission checking
 */
export type PermissionConfig<Permission extends string, Role extends string, UserStatus extends string = string> = {
	/**
	 * Mapping of roles to their permissions
	 */
	rolePermissions: Record<Role, Permission[]>
	
	/**
	 * Optional function to check if a user is active/allowed
	 * Returns true if user is allowed, false otherwise
	 */
	isUserActive?: (user: { status?: UserStatus; [key: string]: any }) => boolean
	
	/**
	 * Optional active status value to check against
	 * If provided, user.status must equal this value
	 */
	activeStatus?: UserStatus
	
	/**
	 * Optional error messages
	 */
	messages?: {
		unauthorized?: string
		banned?: string
		insufficientPermissions?: string
	}
}

/**
 * Session type that must be extended by the consuming application
 */
export type SessionWithRole = {
	user: {
		id: string
		role: string
		status?: string
		[key: string]: any
	}
	[key: string]: any
}

