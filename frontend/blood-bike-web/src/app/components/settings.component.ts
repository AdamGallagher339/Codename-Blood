import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="page-container">
      <h1>Settings</h1>
      <p>Manage your account settings and preferences.</p>
      
      <section class="section">
        <h2>Account Information</h2>
        <div>
          <label>Username:</label>
          <input type="text" placeholder="Your username" disabled />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" placeholder="your@email.com" />
        </div>
        <button>Update Email</button>
      </section>

      <section class="section">
        <h2>Change Password</h2>
        <div>
          <label>Current Password:</label>
          <input type="password" placeholder="Enter current password" />
        </div>
        <div>
          <label>New Password:</label>
          <input type="password" placeholder="Enter new password" />
        </div>
        <div>
          <label>Confirm Password:</label>
          <input type="password" placeholder="Confirm new password" />
        </div>
        <button>Change Password</button>
      </section>

      <section class="section">
        <h2>Preferences</h2>
        <label>
          <input type="checkbox" />
          Enable notifications
        </label>
        <br />
        <label>
          <input type="checkbox" />
          Receive email updates
        </label>
        <br />
        <button style="margin-top: 10px;">Save Preferences</button>
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
    button {
      padding: 8px 16px;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background-color: #5a6268;
    }
  `]
})
export class SettingsComponent {}
