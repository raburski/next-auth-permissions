import "server-only"
import type { SessionWithRole } from "../types"
import { userCan } from "../permissions"
import { getPermissionConfig } from "./config"

/**
 * Check if a session has a specific permission
 * Uses the configured permission config
 */
export function checkPermission<Permission extends string, Role extends string>(
	session: SessionWithRole,
	permission: Permission
): boolean {
	const config = getPermissionConfig<Permission, Role>()
	return userCan(session.user.role as Role, permission, config.rolePermissions)
}

/**
 * Check if a user owns a resource
 * Compares resource.submittedByUserId (or similar) with session.user.id
 */
export function checkOwnership(
	resource: { submittedByUserId?: string | null } | { userId?: string | null } | { ownerId?: string | null },
	session: SessionWithRole
): boolean {
	if ("submittedByUserId" in resource && resource.submittedByUserId) {
		return resource.submittedByUserId === session.user.id
	}
	if ("userId" in resource && resource.userId) {
		return resource.userId === session.user.id
	}
	if ("ownerId" in resource && resource.ownerId) {
		return resource.ownerId === session.user.id
	}
	return false
}

/**
 * Check if a resource matches a state predicate
 */
export function checkResourceState<T>(
	resource: T,
	predicate: (resource: T) => boolean
): boolean {
	return predicate(resource)
}

