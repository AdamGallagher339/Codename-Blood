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
  const requiredRoles = route.data['roles'] as string[];

  if (!requiredRoles || requiredRoles.length === 0) {
    return true; // No role requirement
  }

  if (requiredRoles.includes(selectedRole)) {
    return true;
  }

  console.warn(`Access denied: role '${selectedRole}' not in ${requiredRoles}`);
  router.navigate(['/access-denied']);
  return false;
};
