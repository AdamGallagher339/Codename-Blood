import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  submittedAt: string;
  notes: string;
}

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1>📋 Applications</h1>
      <p>Review and manage volunteer applications.</p>

      <!-- Filters -->
      <div class="filters">
        <label>
          Status:
          <select [(ngModel)]="filterStatus">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          Search:
          <input type="text" [(ngModel)]="searchQuery" placeholder="Name or email…" />
        </label>
      </div>

      <!-- Applications Table -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Applied For</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let app of filteredApplications">
              <td>{{ app.name }}</td>
              <td>{{ app.email }}</td>
              <td>{{ app.phone }}</td>
              <td>{{ app.role }}</td>
              <td>{{ app.submittedAt | date:'short' }}</td>
              <td>
                <span class="status-badge" [ngClass]="app.status">{{ app.status }}</span>
              </td>
              <td>
                <div class="action-btns">
                  <button class="btn-accept" *ngIf="app.status === 'pending' || app.status === 'reviewed'" (click)="updateStatus(app, 'accepted')">Accept</button>
                  <button class="btn-reject" *ngIf="app.status === 'pending' || app.status === 'reviewed'" (click)="updateStatus(app, 'rejected')">Reject</button>
                  <button class="btn-review" *ngIf="app.status === 'pending'" (click)="updateStatus(app, 'reviewed')">Mark Reviewed</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filteredApplications.length === 0">
              <td colspan="7" class="empty">No applications found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 1rem; max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 0.25rem; }
    p { color: #666; margin-bottom: 1rem; }

    .filters {
      display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;
      label { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
      select, input { padding: 0.4rem 0.6rem; border: 1px solid #ccc; border-radius: 6px; }
    }

    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; }
    .empty { text-align: center; padding: 2rem; color: #999; }

    .status-badge {
      padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize;
      &.pending { background: #fff3cd; color: #856404; }
      &.reviewed { background: #cce5ff; color: #004085; }
      &.accepted { background: #d4edda; color: #155724; }
      &.rejected { background: #f8d7da; color: #721c24; }
    }

    .action-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .action-btns button {
      padding: 0.3rem 0.6rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;
    }
    .btn-accept { background: #28a745; color: #fff; }
    .btn-reject { background: #dc3545; color: #fff; }
    .btn-review { background: #17a2b8; color: #fff; }
    .btn-accept:hover { background: #218838; }
    .btn-reject:hover { background: #c82333; }
    .btn-review:hover { background: #138496; }
  `]
})
export class ApplicationsComponent implements OnInit {
  applications: Application[] = [];
  filterStatus = '';
  searchQuery = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadApplications();
  }

  loadApplications(): void {
    // TODO: Replace with real API call when backend endpoint is ready
    // this.http.get<Application[]>('/api/applications').subscribe(apps => this.applications = apps);

    // Sample data for now
    this.applications = [
      { id: '1', name: 'John Murphy', email: 'john@example.com', phone: '087-1234567', role: 'Rider', status: 'pending', submittedAt: new Date().toISOString(), notes: '' },
      { id: '2', name: 'Sarah O\'Brien', email: 'sarah@example.com', phone: '086-7654321', role: 'Rider', status: 'reviewed', submittedAt: new Date(Date.now() - 86400000).toISOString(), notes: '' },
      { id: '3', name: 'Michael Walsh', email: 'mike@example.com', phone: '085-1112233', role: 'Dispatcher', status: 'accepted', submittedAt: new Date(Date.now() - 172800000).toISOString(), notes: '' },
    ];
  }

  get filteredApplications(): Application[] {
    return this.applications.filter(app => {
      const matchesStatus = !this.filterStatus || app.status === this.filterStatus;
      const query = this.searchQuery.toLowerCase();
      const matchesSearch = !query || app.name.toLowerCase().includes(query) || app.email.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }

  updateStatus(app: Application, status: Application['status']): void {
    app.status = status;
    // TODO: Persist via API
    // this.http.put(`/api/applications/${app.id}`, { status }).subscribe();
  }
}
