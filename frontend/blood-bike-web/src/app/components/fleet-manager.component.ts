import { Component } from '@angular/core';

@Component({
  selector: 'app-fleet-manager',
  standalone: true,
  template: `
    <div class="page-container">
      <h1>Fleet Manager Dashboard</h1>
      <p>Monitor vehicle fleet locations, service status, and maintenance tracking.</p>
      
      <section class="section">
        <h2>Active Fleet</h2>
        <table>
          <thead>
            <tr>
              <th>Vehicle ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Current Location</th>
              <th>Hours Since Service</th>
              <th>Last Rider</th>
              <th>Depot</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8">No vehicles in fleet yet</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Service a Vehicle</h2>
        <p>Scan a QR code or select a vehicle to put it in service mode or fill a service report.</p>
        <div>
          <label>Vehicle QR Code or ID:</label>
          <input type="text" placeholder="Scan QR code or enter vehicle ID" />
          <button>Scan for Service</button>
        </div>
        <div style="margin-top: 20px;">
          <h3>Service Report</h3>
          <div>
            <label>Issues/Notes:</label>
            <textarea placeholder="Document any issues or service notes"></textarea>
          </div>
          <button>Submit Service Report</button>
        </div>
      </section>

      <section class="section">
        <h2>Vehicles in Service</h2>
        <ul>
          <li>No vehicles currently in service</li>
        </ul>
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
    div {
      margin: 10px 0;
    }
    label {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
    }
    input, textarea {
      width: 100%;
      padding: 8px;
      box-sizing: border-box;
      font-family: inherit;
    }
    button {
      padding: 8px 16px;
      background-color: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background-color: #218838;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      font-size: 0.9em;
    }
  `]
})
export class FleetManagerComponent {}
