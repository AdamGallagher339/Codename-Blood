import { Injectable } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';

/**
 * Check if the current user has one of the required roles.
 * Roles are retrieved from localStorage under the 'selectedRole' key.
 */
export const hasRoleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const selectedRole = localStorage.getItem('bb_selected_role') || '';
  const requiredRoles = (route.data['roles'] as string[]) || [];
  const storedRolesRaw = localStorage.getItem('bb_roles');
  const storedRoles = storedRolesRaw ? (JSON.parse(storedRolesRaw) as string[]) : [];

  const normalizeRole = (role: string) => role.toLowerCase().replace(/[^a-z0-9]/g, '');
  const requiredNormalized = requiredRoles.map(normalizeRole);
  const selectedNormalized = normalizeRole(selectedRole);
  const storedNormalized = storedRoles.map(normalizeRole);

  if (requiredRoles.length === 0) {
    return true; // No role requirement
  }

  // Allow admins to access all guarded routes.
  const adminRoles = new Set(['bloodbikeadmin', 'admin']);
  const isAdmin = adminRoles.has(selectedNormalized) || storedNormalized.some((role) => adminRoles.has(role));
  if (isAdmin) {
    return true;
  }

  if (selectedRole && requiredNormalized.includes(selectedNormalized)) {
    return true;
  }

  if (storedNormalized.some((role) => requiredNormalized.includes(role))) {
    return true;
  }

  console.warn(`Access denied: role '${selectedRole}' not in ${requiredRoles}`);
  router.navigate(['/access-denied']);
  return false;
};
