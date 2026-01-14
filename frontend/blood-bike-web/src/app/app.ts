import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { EventsPageComponent } from './components/events-page.component';
import { finalize } from 'rxjs';
import { AuthService, AuthPage } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, EventsPageComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  currentPage: string = 'welcome';
  showSettings = false;

  guestMode = false;

  busy = false;

  // Auth form state
  loginUsername = '';
  loginPassword = '';

  signupUsername = '';
  signupEmail = '';
  signupPassword = '';

  confirmUsername = '';
  confirmCode = '';

  private readonly allPages = [
    { id: 'map', title: 'Map', icon: '🗺️' },
    { id: 'scanner', title: 'QR Scanner', icon: '📱' },
    { id: 'events', title: 'Events', icon: '📅' },
    { id: 'communications', title: 'Messages', icon: '💬' },
    { id: 'fleet-maintenance', title: 'Fleet', icon: '🛠️', requiredRole: 'fleet_manager' },
    { id: 'admin-roles', title: 'Admin: Roles', icon: '🧑‍💼', requiredRole: 'admin' }
  ] as const;

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.auth.fetchMe().subscribe(() => {
      this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
      this.guestMode = false;
    });
  }

  get isGuest(): boolean {
    return this.guestMode && !this.auth.isLoggedIn();
  }

  get pages(): Array<{ id: string; title: string; icon: string }> {
    const roles = this.auth.roles();
    return this.allPages.filter((p) => {
      const required = (p as any).requiredRole as string | undefined;
      if (!required) return true;
      if (roles.includes('admin')) return true;
      return roles.includes(required);
    });
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
    this.guestMode = true;
    this.currentPage = 'home';
    this.showSettings = false;
    this.router.navigate(['/']);
  }

  navigateTo(pageId: string): void {
    // Allow navigation in guest mode, but keep role-only sections hidden by `pages`.
    if (!this.auth.isLoggedIn() && !this.guestMode) {
      this.currentPage = 'welcome';
      this.showSettings = false;
      this.router.navigate(['/']);
      return;
    }
    this.currentPage = pageId;

    if (pageId === 'scanner') {
      this.router.navigate(['/scan']);
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
    this.currentPage = 'welcome';
    this.guestMode = false;
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
          this.auth.fetchMe().subscribe(() => {
            this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
          });
        }
      });
  }

  goBack(): void {
    this.currentPage = this.auth.isLoggedIn() ? 'home' : 'welcome';
    this.showSettings = false;
    this.router.navigate(['/']);
  }
}
