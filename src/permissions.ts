/**
 * Core permission checking utilities
 * These functions are generic and work with any permission and role types
 */

/**
 * Check if a user role has a specific permission
 */
export function userCan<Permission extends string, Role extends string>(
	userRole: Role,
	permission: Permission,
	rolePermissions: Record<Role, Permission[]>
): boolean {
	const permissions = rolePermissions[userRole] || []
	return permissions.includes(permission)
}

/**
 * Check if a user role has any of the specified permissions
 */
export function userCanAny<Permission extends string, Role extends string>(
	userRole: Role,
	permissions: Permission[],
	rolePermissions: Record<Role, Permission[]>
): boolean {
	return permissions.some(permission => userCan(userRole, permission, rolePermissions))
}

/**
 * Check if a user role has all of the specified permissions
 */
export function userCanAll<Permission extends string, Role extends string>(
	userRole: Role,
	permissions: Permission[],
	rolePermissions: Record<Role, Permission[]>
): boolean {
	return permissions.every(permission => userCan(userRole, permission, rolePermissions))
}

