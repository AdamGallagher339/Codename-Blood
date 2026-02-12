import { Component } from '@angular/core';

@Component({
  selector: 'app-dispatcher',
  standalone: true,
  template: `
    <div class="page-container">
      <h1>Dispatcher Dashboard</h1>
      <p>Create new jobs, view available riders, and manage delivery runs.</p>
      
      <section class="section">
        <h2>Create New Job/Run</h2>
        <form>
          <div>
            <label>Job Title:</label>
            <input type="text" placeholder="Enter job title" />
          </div>
          <div>
            <label>Hospital/Location:</label>
            <input type="text" placeholder="Enter hospital or location" />
          </div>
          <div>
            <label>Pickup Address:</label>
            <input type="text" placeholder="Pickup location" />
          </div>
          <div>
            <label>Delivery Address:</label>
            <input type="text" placeholder="Delivery location" />
          </div>
          <button type="submit">Create Job</button>
        </form>
      </section>

      <section class="section">
        <h2>Available Riders</h2>
        <p>Riders currently available for jobs:</p>
        <ul>
          <li>No riders available at this time</li>
        </ul>
      </section>

      <section class="section">
        <h2>Active Runs</h2>
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Rider</th>
              <th>Status</th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="4">No active runs</td>
            </tr>
          </tbody>
        </table>
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
    form div {
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
    }
    button {
      padding: 8px 16px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background-color: #0056b3;
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
  `]
})
export class DispatcherComponent {}
