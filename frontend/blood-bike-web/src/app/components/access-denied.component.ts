import { Component } from '@angular/core';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  template: `
    <div class="container">
      <div class="error-box">
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <p>Please switch to an appropriate role or contact an administrator.</p>
        <a routerLink="/tracking">Go back to Dashboard</a>
      </div>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .error-box {
      text-align: center;
      padding: 40px;
      border: 2px solid #dc3545;
      border-radius: 8px;
      background-color: #f8d7da;
      color: #721c24;
    }
    h1 { margin: 0 0 20px; }
    p { margin: 10px 0; }
    a {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background-color: #dc3545;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
    a:hover {
      background-color: #c82333;
    }
  `]
})
export class AccessDeniedComponent {}
