"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import type { SessionWithRole } from "../types"
import { userCan, userCanAny, userCanAll } from "../permissions"
import { usePermissionsContext } from "./context"

/**
 * Hook to check if the current user has a specific permission
 */
export function useUserCan<Permission extends string, Role extends string>(
	permission: Permission
): boolean {
	const { data: session } = useSession()
	const { rolePermissions } = usePermissionsContext<Permission, Role>()
	
	const user = session?.user as SessionWithRole["user"] | undefined
	if (!user?.role) {
		return false
	}
	
	return userCan(user.role as Role, permission, rolePermissions)
}

/**
 * Hook to check if the current user has any of the specified permissions
 */
export function useUserCanAny<Permission extends string, Role extends string>(
	permissions: Permission[]
): boolean {
	const { data: session } = useSession()
	const { rolePermissions } = usePermissionsContext<Permission, Role>()
	
	const user = session?.user as SessionWithRole["user"] | undefined
	if (!user?.role) {
		return false
	}
	
	return userCanAny(user.role as Role, permissions, rolePermissions)
}

/**
 * Hook to check if the current user has all of the specified permissions
 */
export function useUserCanAll<Permission extends string, Role extends string>(
	permissions: Permission[]
): boolean {
	const { data: session } = useSession()
	const { rolePermissions } = usePermissionsContext<Permission, Role>()
	
	const user = session?.user as SessionWithRole["user"] | undefined
	if (!user?.role) {
		return false
	}
	
	return userCanAll(user.role as Role, permissions, rolePermissions)
}

/**
 * Hook to require authentication - redirects to signin if not authenticated
 */
export function useRequireAuthenticatedUser(redirectTo?: string) {
	const { data: session, status } = useSession()
	const router = useRouter()
	const { signinPath } = usePermissionsContext()

	useEffect(() => {
		if (status === "loading") return // Still loading

		if (status === "unauthenticated") {
			// Redirect to signin with current path as redirectTo
			const currentPath = window.location.pathname + window.location.search
			const signinUrl = redirectTo || `${signinPath}?redirectTo=${encodeURIComponent(currentPath)}`
			router.replace(signinUrl)
		}
	}, [status, router, redirectTo, signinPath])

	return {
		session: session as SessionWithRole | null,
		status,
		isLoading: status === "loading",
		isAuthenticated: status === "authenticated",
	}
}

/**
 * Hook to require a specific permission - redirects if user doesn't have permission
 */
export function useRequireUserCan<Permission extends string, Role extends string>(
	permission: Permission,
	redirectTo?: string
) {
	const { session, isLoading } = useRequireAuthenticatedUser(redirectTo)
	const router = useRouter()
	const { rolePermissions, defaultRedirectTo } = usePermissionsContext<Permission, Role>()
	
	const hasPermission = session?.user?.role 
		? userCan(session.user.role as Role, permission, rolePermissions)
		: false

	useEffect(() => {
		if (!isLoading && session && !hasPermission) {
			router.push(redirectTo || defaultRedirectTo)
		}
	}, [session, isLoading, hasPermission, router, redirectTo, defaultRedirectTo])

	return {
		session,
		isLoading,
		hasPermission,
	}
}
