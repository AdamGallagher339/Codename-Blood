import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { EventsPageComponent } from './components/events-page.component';
import { FleetTrackerComponent } from './components/fleet-tracker.component';
import { finalize, filter } from 'rxjs';
import { AuthService, AuthPage } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, HttpClientModule, RouterOutlet, EventsPageComponent, FleetTrackerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  currentPage: string = 'welcome';
  showSettings = false;
  showRoutedView = false;

  // guest mode removed — account creation handled by admin

  busy = false;

  // Auth form state
  loginUsername = '';
  loginPassword = '';

  // Selected role for UI (users can switch between roles)
  selectedRole: string | null = null;

  signupUsername = '';
  signupEmail = '';
  signupPassword = '';

  confirmUsername = '';
  confirmCode = '';

  // Challenge (e.g. NEW_PASSWORD_REQUIRED) form state
  challengeNewPassword = '';
  challengeEmail = '';

  // Admin create-user form
  adminUsername = '';
  adminEmail = '';
  adminPassword = '';
  adminRole = 'BloodBikeAdmin';
  adminRoles: string[] = ['BloodBikeAdmin'];
  adminRoleSelection: { [key: string]: boolean } = {
    'BloodBikeAdmin': true,
    'Rider': false,
    'FleetManager': false,
    'Dispatcher': false
  };

  // Manage users (admin)
  users: Array<any> = [];

  loadUsersBusy = false;
  adminBusy = false;
  adminMessage: string | null = null;

  private readonly allPages: Array<{ id: string; title: string; icon: string; roles: string[] }> = [
    { id: 'tracking', title: 'Map', icon: '🗺️', roles: ['Rider', 'FleetManager', 'Dispatcher'] },
    { id: 'scan', title: 'QR Test', icon: '📱', roles: ['BloodBikeAdmin'] },
    { id: 'jobs', title: 'Jobs', icon: '📋', roles: ['Rider'] },
    { id: 'dispatcher', title: 'Dispatcher', icon: '📞', roles: ['Dispatcher'] },
    { id: 'fleet', title: 'Fleet', icon: '🛠️', roles: ['FleetManager'] },
    { id: 'active-riders', title: 'Active Riders', icon: '🏍️', roles: ['BloodBikeAdmin', 'FleetManager', 'Dispatcher'] },
    { id: 'my-availability', title: 'My Availability', icon: '🟢', roles: ['Rider'] },
    { id: 'events', title: 'Events', icon: '📆', roles: [] },
    { id: 'admin-roles', title: 'Admin: Users', icon: '🧑‍💼', roles: ['BloodBikeAdmin'] }
  ];

  private readonly routedPages = new Set([
    'tracking',
    'scan',
    'dispatcher',
    'fleet',
    'jobs',
    'events',
    'active-riders',
    'my-availability',
    'settings',
    'access-denied'
  ]);

  private enterTracking(): void {
    // Check if user can access tracking based on their roles
    const userRoles = this.auth.roles();
    const trackingRoles = ['Rider', 'FleetManager', 'Dispatcher'];
    const canAccessTracking = userRoles.some((role) => trackingRoles.includes(role));

    if (canAccessTracking) {
      this.currentPage = 'tracking';
      this.showRoutedView = true;
      this.router.navigate(['/tracking']);
    } else {
      // Default to home
      this.currentPage = 'home';
      this.showRoutedView = false;
      this.router.navigate(['/']);
    }
  }

  private normalizeRole(role: string): string {
    return role.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router,
    public readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => this.syncFromUrl((event as NavigationEnd).urlAfterRedirects));

    this.auth.fetchMe().subscribe(() => {
      if (this.auth.isLoggedIn()) {
        this.currentPage = 'home';
        this.showRoutedView = false;
      } else {
        this.currentPage = 'welcome';
        this.showRoutedView = false;
      }
      // restore selected role from localStorage or default to first role
      const saved = localStorage.getItem('bb_selected_role');
      const roles = this.auth.roles();
      if (saved && roles.includes(saved)) {
        this.selectedRole = saved;
      } else if (roles.length > 0) {
        this.setRole(roles[0]); // Use setRole to persist to localStorage
      } else {
        this.setRole(null);
      }
      if (this.auth.hasRole && this.auth.hasRole('BloodBikeAdmin')) {
        // preload users for admin
        this.loadUsers();
      }
    });
  }

  loadUsers(): void {
    if (!this.auth.hasRole || !this.auth.hasRole('BloodBikeAdmin')) {
      console.log('User is not BloodBikeAdmin, skipping loadUsers');
      return;
    }
    console.log('loadUsers: Fetching users from Cognito');
    this.loadUsersBusy = true;
    
    const token = this.auth.getIdToken() || this.auth.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    this.http.get('/api/auth/users', { headers }).subscribe({
      next: (res: any) => {
        console.log('loadUsers success:', res);
        this.users = (res || []).map((u: any) => ({
          riderId: u.username,
          name: u.username,
          email: u.email || '',
          status: u.status || '',
          roles: new Set((u.roles || []) as string[]),
          originalRoles: new Set((u.roles || []) as string[]),
        }));
        console.log('Formatted users:', this.users);
        this.loadUsersBusy = false;
      },
      error: (err: any) => {
        console.error('loadUsers error:', err);
        this.users = [];
        this.loadUsersBusy = false;
      }
    });
  }

  reloadAccounts(): void {
    this.loadUsers();
  }

  allRoles: string[] = ['BloodBikeAdmin', 'Rider', 'FleetManager', 'Dispatcher'];

  hasRole(user: any, role: string): boolean {
    return user.roles.has(role);
  }

  toggleUserRole(user: any, role: string): void {
    if (user.roles.has(role)) {
      user.roles.delete(role);
    } else {
      user.roles.add(role);
    }
  }

  isDirty(user: any): boolean {
    if (user.roles.size !== user.originalRoles.size) return true;
    for (const r of user.roles) {
      if (!user.originalRoles.has(r)) return true;
    }
    return false;
  }

  saveUserRoles(user: any): void {
    const token = this.auth.getIdToken() || this.auth.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    const payload = {
      roles: Array.from(user.roles)
    };

    this.http.put(`/api/users/${encodeURIComponent(user.riderId)}`, payload, { headers }).subscribe({
      next: () => {
        console.log('User roles updated successfully');
        user.originalRoles = new Set(user.roles);
      },
      error: (err) => {
        console.error('Failed to update user roles:', err);
        alert(`Failed to update roles: ${err.error?.message || err.message}`);
      }
    });
  }

  deleteUser(user: any): void {
    if (!confirm(`Are you sure you want to delete user "${user.riderId}"?`)) {
      return;
    }

    const token = this.auth.getIdToken() || this.auth.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.delete(`/api/users/${encodeURIComponent(user.riderId)}`, { headers }).subscribe({
      next: () => {
        console.log('User deleted:', user.riderId);
        this.users = this.users.filter(u => u.riderId !== user.riderId);
      },
      error: (err) => {
        console.error('Failed to delete user:', err);
        alert(`Failed to delete user: ${err.error?.message || err.message}`);
      }
    });
  }

  // guest mode removed

  get pages(): Array<{ id: string; title: string; icon: string; roles: string[] }> {
    const active = this.selectedRole;
    const activeNormalized = active ? this.normalizeRole(active) : null;
    const userRolesNormalized = this.auth.roles().map((role) => this.normalizeRole(role));
    return this.allPages.filter((p) => {
      const pageRoles = (p as any).roles as string[];
      if (pageRoles.length === 0) return true; // Available to all

      const pageRolesNormalized = pageRoles.map((role) => this.normalizeRole(role));
      if (activeNormalized) return pageRolesNormalized.includes(activeNormalized);

      return userRolesNormalized.some((role) => pageRolesNormalized.includes(role));
    });
  }

  toggleAdminRole(role: string): void {
    if (this.adminRoles.includes(role)) {
      this.adminRoles = this.adminRoles.filter(r => r !== role);
    } else {
      this.adminRoles.push(role);
    }
  }

  syncAdminRoles(): void {
    // Sync from adminRoleSelection to adminRoles array
    this.adminRoles = Object.keys(this.adminRoleSelection)
      .filter(role => this.adminRoleSelection[role]);
    console.log('Admin roles updated:', this.adminRoles);
  }

  toggleRole(role: string): void {
    // Toggle role selection and sync to array
    this.adminRoleSelection[role] = !this.adminRoleSelection[role];
    this.syncAdminRoles();
  }

  get footerPages(): Array<{ id: string; title: string; icon: string; roles: string[] }> {
    return this.pages.filter((page) => page.id !== 'admin-roles');
  }

  setRole(role: string | null): void {
    this.selectedRole = role;
    if (role) localStorage.setItem('bb_selected_role', role);
    else localStorage.removeItem('bb_selected_role');
  }

  navigateAuth(page: AuthPage): void {
    this.currentPage = page;
    this.showRoutedView = false;
    this.showSettings = false;
    this.router.navigate(['/']);
  }

  isOnHomePage(): boolean {
    if (!this.auth.isLoggedIn()) return this.currentPage === 'welcome';
    return this.currentPage === 'home';
  }

  goHomeOrWelcome(): void {
    if (!this.auth.isLoggedIn()) {
      this.currentPage = 'welcome';
      this.showRoutedView = false;
      this.router.navigate(['/']);
      this.showSettings = false;
      return;
    }

    this.currentPage = 'home';
    this.showRoutedView = false;
    this.router.navigate(['/']);
    this.showSettings = false;
  }

  continueAsGuest(): void {
    // guest mode removed — no-op
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
    this.showRoutedView = false;
  }

  navigateTo(pageId: string): void {
    if (!this.auth.isLoggedIn() && this.routedPages.has(pageId)) {
      this.navigateAuth('login');
      return;
    }
    if (this.routedPages.has(pageId)) {
      this.currentPage = pageId;
      this.showRoutedView = true;
      this.router.navigate([`/${pageId}`]);
    } else {
      this.currentPage = pageId;
      this.showRoutedView = false;
      this.router.navigate(['/']);
    }
    this.showSettings = false;
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  closeSettings(): void {
    this.showSettings = false;
  }

  logout(): void {
    this.auth.logout();
    this.setRole(null);
    this.currentPage = 'welcome';
    this.showRoutedView = false;
    this.showSettings = false;
    this.router.navigate(['/']);
  }

  signUp(): void {
    this.busy = true;
    this.auth
      .signUp({
        username: this.signupUsername.trim(),
        email: this.signupEmail.trim(),
        password: this.signupPassword
      })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          this.confirmUsername = this.signupUsername.trim();
          this.currentPage = 'confirm';
        }
      });
  }

  confirmSignUp(): void {
    this.busy = true;
    this.auth
      .confirmSignUp({
        username: this.confirmUsername.trim(),
        code: this.confirmCode.trim()
      })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          this.loginUsername = this.confirmUsername.trim();
          this.currentPage = 'login';
        }
      });
  }

  signIn(): void {
    this.busy = true;
    this.auth
      .signIn({
        username: this.loginUsername.trim(),
        password: this.loginPassword
      })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          // populate user information then go to home menu
          this.auth.fetchMe().subscribe({
            next: () => {
              this.currentPage = 'home';
              this.showRoutedView = false;
              // restore selected role if available
              const saved = localStorage.getItem('bb_selected_role');
              const roles = this.auth.roles();
              if (saved && roles.includes(saved)) this.selectedRole = saved;
              else if (roles.length > 0) this.selectedRole = roles[0];
              if (this.auth.hasRole && this.auth.hasRole('BloodBikeAdmin')) {
                this.loadUsers();
              }
            },
            error: () => {
              // fetch failed — AuthService may have logged out; ensure we show login
              if (!this.auth.isLoggedIn()) this.currentPage = 'login';
            }
          });
        },
        error: () => {
          // If a challenge is pending, switch to the challenge page
          if (this.auth.pendingChallenge()) {
            this.currentPage = 'challenge';
          }
        }
      });
  }

  submitChallenge(): void {
    this.busy = true;
    this.auth
      .respondToChallenge(this.challengeNewPassword)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          this.challengeNewPassword = '';
          this.auth.fetchMe().subscribe({
            next: () => {
              this.currentPage = 'home';
              this.showRoutedView = false;
              const saved = localStorage.getItem('bb_selected_role');
              const roles = this.auth.roles();
              if (saved && roles.includes(saved)) this.selectedRole = saved;
              else if (roles.length > 0) this.selectedRole = roles[0];
            },
            error: () => {
              if (!this.auth.isLoggedIn()) this.currentPage = 'login';
            }
          });
        }
      });
  }

  goBack(): void {
    this.goHomeOrWelcome();
  }

  private syncFromUrl(url: string): void {
    const clean = url.split('?')[0].split('#')[0];
    const path = clean.replace(/^\//, '');

    if (!path) {
      this.showRoutedView = false;
      return;
    }

    if (this.routedPages.has(path)) {
      this.currentPage = path;
      this.showRoutedView = true;
      return;
    }

    this.showRoutedView = false;
  }

  createAccountByAdmin(): void {
    if (!this.adminUsername || !this.adminEmail) {
      this.adminMessage = 'username and email required';
      return;
    }
    const username = this.adminUsername.trim();
    if (/\s/.test(username)) {
      this.adminMessage = 'Username cannot contain spaces';
      return;
    }
    if (this.adminRoles.length === 0) {
      this.adminMessage = 'at least one role must be selected';
      return;
    }
    this.adminBusy = true;
    this.adminMessage = null;

    const token = this.auth.getIdToken() || this.auth.getAccessToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const payload: Record<string, any> = {
      username: this.adminUsername.trim(),
      email: this.adminEmail.trim(),
      roles: this.adminRoles
    };
    // Only include temporaryPassword if the admin explicitly set one;
    // otherwise Cognito will auto-generate one and email it to the user.
    if (this.adminPassword) {
      payload['password'] = this.adminPassword;
    }

    // 1. Create Cognito user (admin API — auto-confirmed with permanent password + groups)
    this.http.post('/api/auth/admin/create-user', payload, { headers }).subscribe({
      next: () => {
        // 2. Create fleet user record in DynamoDB
        const fleetUser = { riderId: this.adminUsername.trim(), name: this.adminUsername.trim() };
        this.http.post('/api/user/register', fleetUser, { headers }).subscribe({
          next: () => {
            // 3. Initialize roles in DynamoDB (tags) + sync to Cognito groups
            this.http.post('/api/user/roles/init', { riderId: this.adminUsername.trim(), roles: this.adminRoles }, { headers }).subscribe({
              next: () => {
                this.adminMessage = this.adminPassword
                  ? 'Account created — user can sign in with the temporary password'
                  : 'Account created — user will receive an email with a temporary password';
                this.adminBusy = false;
                this.adminUsername = '';
                this.adminEmail = '';
                this.adminPassword = '';
                this.adminRoles = ['BloodBikeAdmin'];
                this.adminRoleSelection = {
                  'BloodBikeAdmin': true,
                  'Rider': false,
                  'FleetManager': false,
                  'Dispatcher': false
                };
                this.loadUsers();
              },
              error: (err) => {
                console.error('Failed to initialize roles:', err);
                this.adminMessage = 'Created user but failed to assign roles in fleet DB';
                this.adminBusy = false;
                this.loadUsers();
              }
            });
          },
          error: (err) => {
            console.error('Fleet user registration error:', err);
            const errorMsg = err.error?.message || err.error || err.statusText || `HTTP ${err.status}`;
            this.adminMessage = `Created auth user but failed to register fleet profile: ${errorMsg}`;
            this.adminBusy = false;
          }
        });
      },
      error: (err) => {
        console.error('Admin create user error:', err);
        const errorMsg = typeof err.error === 'string' ? err.error : (err.error?.message || err.statusText || 'unknown error');
        this.adminMessage = `Create user failed: ${errorMsg}`;
        this.adminBusy = false;
      }
    });
  }
}
