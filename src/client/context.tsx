"use client"

import React, { createContext, useContext, type ReactNode } from "react"

/**
 * Configuration options for PermissionsProvider
 */
export interface PermissionsProviderProps<Permission extends string, Role extends string> {
	children: ReactNode
	rolePermissions: Record<Role, Permission[]>
	/**
	 * Default path to redirect to when user is not authenticated
	 * @default "/signin"
	 */
	signinPath?: string
	/**
	 * Default path to redirect to when user doesn't have required permission
	 * @default "/"
	 */
	defaultRedirectTo?: string
}

/**
 * Context for permission configuration
 */
export interface PermissionsContextValue<Permission extends string, Role extends string> {
	rolePermissions: Record<Role, Permission[]>
	signinPath: string
	defaultRedirectTo: string
}

const PermissionsContext = createContext<PermissionsContextValue<any, any> | null>(null)

/**
 * Provider component for permissions configuration
 */
export function PermissionsProvider<Permission extends string, Role extends string>({
	children,
	rolePermissions,
	signinPath = "/signin",
	defaultRedirectTo = "/",
}: PermissionsProviderProps<Permission, Role>) {
	return (
		<PermissionsContext.Provider value={{ 
			rolePermissions,
			signinPath,
			defaultRedirectTo,
		}}>
			{children}
		</PermissionsContext.Provider>
	)
}

/**
 * Hook to access permissions context
 */
export function usePermissionsContext<Permission extends string, Role extends string>(): PermissionsContextValue<Permission, Role> {
	const context = useContext(PermissionsContext)
	if (!context) {
		throw new Error("usePermissionsContext must be used within a PermissionsProvider")
	}
	return context as PermissionsContextValue<Permission, Role>
}

