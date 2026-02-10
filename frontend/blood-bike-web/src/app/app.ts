import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EventsPageComponent } from './components/events-page.component';
import { finalize } from 'rxjs';
import { AuthService, AuthPage } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, HttpClientModule, RouterOutlet, RouterLink, EventsPageComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  currentPage: string = 'welcome';
  showSettings = false;

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

  private readonly allPages = [
    { id: 'map', title: 'Map', icon: '🗺️', requiredRole: 'rider' },
    { id: 'scanner', title: 'QR Scanner', icon: '📱', requiredRole: 'rider' },
    { id: 'events', title: 'Events', icon: '📅' },
    { id: 'communications', title: 'Messages', icon: '💬' },
    { id: 'fleet-maintenance', title: 'Fleet', icon: '🛠️', requiredRole: 'fleet_manager' },
    { id: 'admin-roles', title: 'Admin: Roles', icon: '🧑‍💼', requiredRole: 'BloodBikeAdmin' }
  ] as const;

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router,
    public readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.auth.fetchMe().subscribe(() => {
      this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
      // restore selected role from localStorage or default to first role
      const saved = localStorage.getItem('bb_selected_role');
      const roles = this.auth.roles();
      if (saved && roles.includes(saved)) {
        this.selectedRole = saved;
      } else if (roles.length > 0) {
        this.selectedRole = roles[0];
      } else {
        this.selectedRole = null;
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

  get pages(): Array<{ id: string; title: string; icon: string }> {
    const roles = this.auth.roles();
    const active = this.selectedRole;
    return this.allPages.filter((p) => {
      const required = (p as any).requiredRole as string | undefined;
      if (!required) return true;
      // If user has selected a role, use that to gate pages.
      if (active) return active === required || active.includes(required);
      // Fallback: check any of user's roles
      return roles.includes(required);
    });
  }

  setRole(role: string | null): void {
    this.selectedRole = role;
    if (role) localStorage.setItem('bb_selected_role', role);
    else localStorage.removeItem('bb_selected_role');
  }

  navigateAuth(page: AuthPage): void {
    this.currentPage = page;
    this.showSettings = false;
    this.router.navigate(['/']);
  }

  goHomeOrWelcome(): void {
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
    this.showSettings = false;
    this.router.navigate(['/']);
  }

  continueAsGuest(): void {
    // guest mode removed — no-op
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
  }

  navigateTo(pageId: string): void {
    // Always navigate to the selected page; UI will hide tabs the user
    // shouldn't see. Pages can implement their own auth checks later.
    this.currentPage = pageId;
    if (pageId === 'scanner') {
      this.router.navigate(['/scan']);
    } else if (pageId === 'map') {
      this.router.navigate(['/tracking']);
    } else if (pageId === 'events') {
      this.router.navigate(['/events']);
    } else {
      this.router.navigate(['/']);
    }
    this.showSettings = false;

    if (pageId === 'scanner') {
      this.router.navigate(['/scan']);
    } else if (pageId === 'map') {
      this.router.navigate(['/tracking']);
    } else {
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
          // Immediately navigate to home so the UI doesn't loop back to login.
          this.currentPage = 'home';
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
    this.showSettings = false;
    this.router.navigate(['/']);
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
