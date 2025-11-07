import "server-only"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { PermissionConfig, SessionWithRole } from "../types"
import { userCan } from "../permissions"
import { getAuth, getPermissionConfig } from "./config"

/**
 * Result type for auth utilities
 */
export type AuthResult<TSession extends SessionWithRole = SessionWithRole> = {
	session: TSession | null
	error: NextResponse | null
}

/**
 * Internal implementation that takes auth function as parameter
 * Used by the public API and for testing
 */
export async function requireAuthInternal<TSession extends SessionWithRole = SessionWithRole>(
	auth: () => Promise<Session | null>
): Promise<AuthResult<TSession>> {
	const session = await auth()
	
	if (!session?.user) {
		return {
			error: NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			),
			session: null,
		}
	}

	return { session: session as unknown as TSession, error: null }
}

/**
 * Internal implementation that takes auth and config as parameters
 * Used by the public API and for testing
 */
export async function requireUserCanInternal<
	Permission extends string,
	Role extends string,
	UserStatus extends string = string,
	TSession extends SessionWithRole = SessionWithRole
>(
	permission: Permission,
	auth: () => Promise<Session | null>,
	config: PermissionConfig<Permission, Role, UserStatus>
): Promise<AuthResult<TSession>> {
	const { session, error } = await requireAuthInternal<TSession>(auth)
	
	if (error) {
		return { error, session: null }
	}

	if (!session) {
		return {
			error: NextResponse.json(
				{ message: config.messages?.unauthorized || "Unauthorized" },
				{ status: 401 }
			),
			session: null,
		}
	}

	// Check if user is active (if configured)
	if (config.isUserActive) {
		if (!config.isUserActive(session.user as { status?: UserStatus; [key: string]: any })) {
			return {
				error: NextResponse.json(
					{ message: config.messages?.banned || "Your account has been banned" },
					{ status: 403 }
				),
				session: null,
			}
		}
	} else if (config.activeStatus !== undefined) {
		if (session.user.status !== config.activeStatus) {
			return {
				error: NextResponse.json(
					{ message: config.messages?.banned || "Your account has been banned" },
					{ status: 403 }
				),
				session: null,
			}
		}
	}

	// Check if user has the required permission
	if (!userCan(session.user.role as Role, permission, config.rolePermissions)) {
		return {
			error: NextResponse.json(
				{ message: config.messages?.insufficientPermissions || "Insufficient permissions" },
				{ status: 403 }
			),
			session: null,
		}
	}

	return { session, error: null }
}

/**
 * Require authentication - checks if user is logged in
 * Uses the configured auth function from configurePermissions()
 */
export async function requireAuth<TSession extends SessionWithRole = SessionWithRole>(): Promise<AuthResult<TSession>> {
	return requireAuthInternal<TSession>(getAuth())
}

/**
 * Require user to have a specific permission
 * Also checks if user is active (if configured)
 * Uses the configured auth function and config from configurePermissions()
 */
export async function requireUserCan<
	Permission extends string,
	Role extends string,
	UserStatus extends string = string,
	TSession extends SessionWithRole = SessionWithRole
>(permission: Permission): Promise<AuthResult<TSession>> {
	const auth = getAuth()
	const config = getPermissionConfig<Permission, Role, UserStatus>()
	return requireUserCanInternal<Permission, Role, UserStatus, TSession>(permission, auth, config)
}
