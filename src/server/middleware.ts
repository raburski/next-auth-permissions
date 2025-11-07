import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { APIHandler, APIContext, Middleware, SessionWithRole } from "../types"
import { requireAuth, requireUserCan } from "./authUtils"

/**
 * Authentication middleware - ensures user is authenticated
 * Uses the configured auth function from configurePermissions()
 * 
 * @example
 * ```typescript
 * export const POST = withAuth(handler)
 * ```
 */
export const withAuth: Middleware = <T>(handler: APIHandler<T>): APIHandler<T> => {
	return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
		const { session: validatedSession, error } = await requireAuth()
		if (error) {
			return error
		}
		
		// Add the validated session to the context
		const newContext: APIContext<T> = {
			...context,
			session: validatedSession
		}
		
		return handler(request, newContext)
	}
}

/**
 * Permission middleware - ensures user has the required permission
 * Uses the configured auth function and config from configurePermissions()
 * 
 * @example
 * ```typescript
 * export const POST = withPermission(Permission.BUILDINGS_ADD)(handler)
 * ```
 */
export function withPermission<Permission extends string>(
	permission: Permission
): Middleware {
	return <T>(handler: APIHandler<T>): APIHandler<T> => {
		return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
			const { session: validatedSession, error } = await requireUserCan(permission)
			if (error) {
				return error
			}
			
			// Add the validated session to the context
			const newContext: APIContext<T> = {
				...context,
				session: validatedSession
			}
			
			return handler(request, newContext)
		}
	}
}

/**
 * Custom permission middleware - allows custom permission checking logic
 * The checker function receives the session and context, and should return
 * true if access is allowed, false otherwise.
 * 
 * @example
 * ```typescript
 * const withBuildingEditPermission = withCustomPermission(
 *   async (session, context) => {
 *     const building = context.resource as Building
 *     return checkPermission(session, Permission.BUILDINGS_EDIT) ||
 *            (checkOwnership(building, session) && 
 *             checkResourceState(building, b => b.status === BuildingStatus.DRAFT))
 *   }
 * )
 * ```
 */
export function withCustomPermission(
	checker: (
		session: SessionWithRole,
		context: APIContext
	) => boolean | Promise<boolean>,
	options?: {
		errorMessage?: string
		errorStatus?: number
	}
): Middleware {
	return <T>(handler: APIHandler<T>): APIHandler<T> => {
		return async (request: NextRequest, context: APIContext<T>): Promise<NextResponse> => {
			const { session, error } = await requireAuth()
			if (error) {
				return error
			}

			if (!session) {
				return NextResponse.json(
					{ message: options?.errorMessage || "Unauthorized" },
					{ status: options?.errorStatus || 401 }
				)
			}

			const canAccess = await checker(session, context)
			if (!canAccess) {
				return NextResponse.json(
					{ message: options?.errorMessage || "Insufficient permissions" },
					{ status: options?.errorStatus || 403 }
				)
			}

			// Add the validated session to the context
			const newContext: APIContext<T> = {
				...context,
				session,
			}

			return handler(request, newContext)
		}
	}
}
