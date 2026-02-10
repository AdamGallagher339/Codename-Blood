import { Component } from '@angular/core';

@Component({
  selector: 'app-rider-jobs',
  standalone: true,
  template: `
    <div class="page-container">
      <h1>Rider - Available Jobs</h1>
      <p>View and accept available delivery jobs.</p>
      
      <section class="section">
        <h2>My Status</h2>
        <div class="status-controls">
          <label>
            <input type="radio" name="status" value="available" (click)="setStatus('available')" [checked]="status === 'available'" />
            Available
          </label>
          <label>
            <input type="radio" name="status" value="unavailable" (click)="setStatus('unavailable')" [checked]="status === 'unavailable'" />
            Unavailable
          </label>
        </div>
      </section>

      <section class="section">
        <h2>Available Jobs</h2>
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>From</th>
              <th>To</th>
              <th>Vehicle Type</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6">No available jobs at this time</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>My Active Ride</h2>
        <p>Current ride information will appear here when you accept a job.</p>
        <div>
          <p><strong>Status:</strong> No active ride</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .status-controls {
      display: flex;
      gap: 20px;
    }
    .status-controls label {
      display: flex;
      align-items: center;
      font-weight: normal;
    }
    .status-controls input {
      margin-right: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    button {
      padding: 6px 12px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: #0056b3;
    }
  `]
})
export class RiderJobsComponent {
  status = 'available';

  setStatus(newStatus: string) {
    this.status = newStatus;
    // TODO: Send status to backend
  }
}
