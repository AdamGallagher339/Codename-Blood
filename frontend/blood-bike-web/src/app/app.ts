import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EventsPageComponent } from './components/events-page.component';
import { finalize, filter } from 'rxjs';
import { AuthService, AuthPage } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, HttpClientModule, RouterOutlet, EventsPageComponent],
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

  // Admin create-user form
  adminUsername = '';
  adminEmail = '';
  adminPassword = '';
  adminRole = 'BloodBikeAdmin';
  adminRoles: string[] = ['BloodBikeAdmin'];

  // Manage users (admin)
  users: Array<any> = [];

  loadUsersBusy = false;
  adminBusy = false;
  adminMessage: string | null = null;

  private readonly allPages: Array<{ id: string; title: string; icon: string; roles: string[] }> = [
    { id: 'tracking', title: 'Map', icon: '🗺️', roles: ['Rider', 'FleetManager', 'Dispatcher'] },
    { id: 'scan', title: 'QR Scanner', icon: '📱', roles: ['Rider', 'FleetManager'] },
    { id: 'jobs', title: 'Jobs', icon: '📋', roles: ['Rider'] },
    { id: 'dispatcher', title: 'Dispatcher', icon: '📞', roles: ['Dispatcher'] },
    { id: 'fleet', title: 'Fleet', icon: '🛠️', roles: ['FleetManager'] },
    { id: 'community-events', title: 'Community Events', icon: '🎉', roles: [] },
    { id: 'settings', title: 'Settings', icon: '⚙️', roles: [] },
    { id: 'admin-roles', title: 'Admin: Users', icon: '🧑‍💼', roles: ['BloodBikeAdmin'] }
  ];

  private readonly routedPages = new Set([
    'tracking',
    'scan',
    'dispatcher',
    'fleet',
    'jobs',
    'events',
    'community-events',
    'settings',
    'access-denied'
  ]);

  private enterTracking(): void {
    this.currentPage = 'tracking';
    this.showRoutedView = true;
    this.router.navigate(['/tracking']);
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
        this.enterTracking();
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
    if (!this.auth.hasRole || !this.auth.hasRole('BloodBikeAdmin')) return;
    this.loadUsersBusy = true;
    this.http.get('/api/users').subscribe({
      next: (res: any) => {
        this.users = (res || []).map((u: any) => ({
          riderId: u.riderId,
          name: u.name,
          tags: u.tags || [],
          editTags: [...(u.tags || [])],
        }));
        this.loadUsersBusy = false;
      },
      error: () => {
        this.users = [];
        this.loadUsersBusy = false;
      }
    });
  }

  toggleEditTag(user: any, role: string): void {
    const idx = (user.editTags || []).indexOf(role);
    if (idx === -1) user.editTags.push(role);
    else user.editTags.splice(idx, 1);
  }

  saveUserRoles(user: any): void {
    const orig = user.tags || [];
    const updated = user.editTags || [];
    const toAdd = updated.filter((r: string) => !orig.includes(r));
    const toRemove = orig.filter((r: string) => !updated.includes(r));

    const calls: any[] = [];
    toAdd.forEach((r: string) => calls.push(this.http.post('/api/user/tags/add', { riderId: user.riderId, tag: r }).toPromise()));
    toRemove.forEach((r: string) => calls.push(this.http.post('/api/user/tags/remove', { riderId: user.riderId, tag: r }).toPromise()));

    Promise.all(calls).then(() => {
      user.tags = [...user.editTags];
    }).catch(() => {
      // ignore errors for now
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

  goHomeOrWelcome(): void {
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
    this.showRoutedView = false;
    this.showSettings = false;
    this.router.navigate(['/']);
  }

  continueAsGuest(): void {
    // guest mode removed — no-op
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
    this.showRoutedView = false;
  }

  navigateTo(pageId: string): void {
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
          // Land on tracking after login.
          this.enterTracking();
          // populate user information (if fetch fails, AuthService will clear tokens)
          this.auth.fetchMe().subscribe({
            next: () => {
              // restore selected role if available
              const saved = localStorage.getItem('bb_selected_role');
              const roles = this.auth.roles();
              if (saved && roles.includes(saved)) this.selectedRole = saved;
              else if (roles.length > 0) this.selectedRole = roles[0];
            },
            error: () => {
              // fetch failed — AuthService may have logged out; ensure we show login
              if (!this.auth.isLoggedIn()) this.currentPage = 'login';
            }
          });
        }
      });
  }

  goBack(): void {
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
    this.showRoutedView = false;
    this.showSettings = false;
    this.router.navigate(['/']);
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
    if (!this.adminUsername || !this.adminPassword || !this.adminEmail) {
      this.adminMessage = 'username, email and password required';
      return;
    }
    this.adminBusy = true;
    this.adminMessage = null;
    const payload = {
      username: this.adminUsername.trim(),
      password: this.adminPassword,
      email: this.adminEmail.trim(),
      roles: this.adminRoles
    };
    // Create auth user (Cognito or local)
    this.http.post('/api/auth/signup', payload).subscribe({
      next: () => {
        // create fleet user record
        const u = { riderId: this.adminUsername.trim(), name: this.adminUsername.trim() };
        this.http.post('/api/user/register', u).subscribe({
          next: () => {
            // add role tag to user record
            this.http.post('/api/user/tags/add', { riderId: this.adminUsername.trim(), tag: this.adminRole }).subscribe({
              next: () => {
                this.adminMessage = 'Account created';
                this.adminBusy = false;
                this.adminUsername = '';
                this.adminEmail = '';
                this.adminPassword = '';
                this.loadUsers();
              },
              error: (err) => {
                this.adminMessage = 'Created auth user but failed to tag user';
                this.adminBusy = false;
              }
            });
          },
          error: (err) => {
            this.adminMessage = 'Created auth user but failed to register fleet user';
            this.adminBusy = false;
          }
        });
      },
      error: (_err) => {
        this.adminMessage = 'signup failed';
        this.adminBusy = false;
      }
    });
  }
}
