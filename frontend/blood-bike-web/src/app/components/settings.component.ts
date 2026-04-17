import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { PushNotificationService } from '../services/push-notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1>Settings</h1>
      <p>Manage your account settings and preferences.</p>

      <section class="section">
        <h2>Account Information</h2>
        <div>
          <label>Username:</label>
          <input type="text" [value]="username()" disabled />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" [(ngModel)]="newEmail" placeholder="your&#64;email.com" />
        </div>
        <button [disabled]="emailBusy()" (click)="updateEmail()">
          {{ emailBusy() ? 'Updating…' : 'Update Email' }}
        </button>
      </section>

      <section class="section">
        <h2>Change Password</h2>
        <div>
          <label>Current Password:</label>
          <input type="password" [(ngModel)]="currentPassword" placeholder="Enter current password" autocomplete="current-password" />
        </div>
        <div>
          <label>New Password:</label>
          <input type="password" [(ngModel)]="proposedPassword" placeholder="Enter new password" autocomplete="new-password" />
        </div>
        <div>
          <label>Confirm Password:</label>
          <input type="password" [(ngModel)]="confirmPassword" placeholder="Confirm new password" autocomplete="new-password" />
        </div>
        <p *ngIf="passwordMismatch()" class="field-error">Passwords do not match</p>
        <button [disabled]="passwordBusy() || !canChangePassword()" (click)="changePassword()">
          {{ passwordBusy() ? 'Changing…' : 'Change Password' }}
        </button>
      </section>

      <section class="section">
        <h2>Preferences</h2>
        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="notificationsEnabled" (ngModelChange)="savePreferences()" />
          Enable push notifications
        </label>
      </section>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    div {
      margin: 10px 0;
    }
    label {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
    }
    input {
      width: 100%;
      padding: 8px;
      box-sizing: border-box;
    }
    input[type="checkbox"] {
      width: auto;
      margin-right: 8px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      font-weight: normal;
    }
    button {
      padding: 8px 16px;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover:not(:disabled) {
      background-color: #5a6268;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .field-error {
      color: #dc3545;
      font-size: 0.85rem;
      margin: 4px 0 0;
    }
  `]
})
export class SettingsComponent implements OnInit {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private notifications = inject(NotificationService);
  private pushService = inject(PushNotificationService);

  username = computed(() => this.auth.username());
  currentEmail = computed(() => this.auth.user()?.email ?? '');

  newEmail = '';
  currentPassword = '';
  proposedPassword = '';
  confirmPassword = '';
  notificationsEnabled = false;

  emailBusy = signal(false);
  passwordBusy = signal(false);

  passwordMismatch = computed(() =>
    this.confirmPassword.length > 0 && this.proposedPassword !== this.confirmPassword
  );

  canChangePassword = computed(() =>
    this.currentPassword.length > 0 &&
    this.proposedPassword.length >= 8 &&
    this.proposedPassword === this.confirmPassword
  );

  ngOnInit(): void {
    this.newEmail = this.currentEmail();
    this.notificationsEnabled = localStorage.getItem('bb_push_enabled') === '1';
  }

  updateEmail(): void {
    const email = this.newEmail.trim();
    if (!email || !email.includes('@')) {
      this.notifications.warning('Please enter a valid email address.', 'settings:email');
      return;
    }
    this.emailBusy.set(true);
    this.http.post<{ message: string }>('/api/auth/update-email', { email }).subscribe({
      next: (res) => {
        this.emailBusy.set(false);
        this.notifications.success(res.message, 'settings:email');
        // Refresh the user signal so the rest of the app sees the new email
        this.auth.fetchMe().subscribe();
      },
      error: (err) => {
        this.emailBusy.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Could not update email.';
        this.notifications.error(msg, 'settings:email');
      },
    });
  }

  changePassword(): void {
    this.passwordBusy.set(true);
    this.http
      .post<{ message: string }>('/api/auth/change-password', {
        previousPassword: this.currentPassword,
        proposedPassword: this.proposedPassword,
      })
      .subscribe({
        next: (res) => {
          this.passwordBusy.set(false);
          this.currentPassword = '';
          this.proposedPassword = '';
          this.confirmPassword = '';
          this.notifications.success(res.message, 'settings:password');
        },
        error: (err) => {
          this.passwordBusy.set(false);
          const msg = typeof err.error === 'string' ? err.error : 'Could not change password.';
          this.notifications.error(msg, 'settings:password');
        },
      });
  }

  savePreferences(): void {
    if (this.notificationsEnabled) {
      localStorage.setItem('bb_push_enabled', '1');
      this.pushService.subscribe().then((ok) => {
        if (ok) {
          this.notifications.success('Push notifications enabled.', 'settings:push');
        } else {
          this.notificationsEnabled = false;
          localStorage.setItem('bb_push_enabled', '0');
          this.notifications.warning('Could not enable push notifications. Check browser permissions.', 'settings:push');
        }
      });
    } else {
      localStorage.setItem('bb_push_enabled', '0');
      this.pushService.unsubscribe().then(() => {
        this.notifications.info('Push notifications disabled.', 'settings:push');
      });
    }
  }
}
