import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  applicationPdf?: string;
  motorcycleExperienceYears: number;
  availableFreeTimePerWeek: string;
  hasValidRospaCertificate: boolean;
  application: string;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: string;
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
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
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
              <th>Phone</th>
              <th>Full Application</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let app of filteredApplications">
              <td>{{ app.name }}</td>
              <td>{{ app.phone }}</td>
              <td>
                <a *ngIf="getApplicationPdfUrl(app) as pdfUrl" [href]="pdfUrl" target="_blank" rel="noopener noreferrer">View PDF</a>
                <span *ngIf="!getApplicationPdfUrl(app)">Not provided</span>
              </td>
              <td>{{ app.submittedAt | date:'short' }}</td>
              <td>
                <span class="status-badge" [ngClass]="app.status">{{ app.status }}</span>
              </td>
              <td>
                <div class="action-btns">
                  <button class="btn-accept" *ngIf="app.status === 'pending'" (click)="updateStatus(app, 'approved')">Approve</button>
                  <button class="btn-reject" *ngIf="app.status === 'pending'" (click)="updateStatus(app, 'denied')">Deny</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filteredApplications.length === 0">
              <td colspan="6" class="empty">No applications found.</td>
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
      &.approved { background: #d4edda; color: #155724; }
      &.denied { background: #f8d7da; color: #721c24; }
    }

    .action-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .action-btns button {
      padding: 0.3rem 0.6rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;
    }
    .btn-accept { background: #28a745; color: #fff; }
    .btn-reject { background: #dc3545; color: #fff; }
    .btn-accept:hover { background: #218838; }
    .btn-reject:hover { background: #c82333; }
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
    this.http.get<Application[]>('/api/applications').subscribe({
      next: (apps) => {
        this.applications = apps ?? [];
      },
      error: (err) => {
        if (err?.status === 404) {
          this.http.get<Application[]>('/api/application').subscribe({
            next: (apps) => {
              this.applications = apps ?? [];
            },
            error: () => {
              this.applications = [];
            }
          });
          return;
        }
        this.applications = [];
      }
    });
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
    this.http.patch(`/api/applications/${app.id}/status`, { status }).subscribe({
      next: () => {
        app.status = status;
      }
    });
  }

  getApplicationPdfUrl(app: Application): string | null {
    if (app.applicationPdf && this.looksLikePdfUrl(app.applicationPdf)) {
      return app.applicationPdf;
    }
    if (app.application && this.looksLikePdfUrl(app.application)) {
      return app.application;
    }
    return null;
  }

  private looksLikePdfUrl(value: string): boolean {
    const trimmed = (value || '').trim().toLowerCase();
    return trimmed.startsWith('data:application/pdf') || trimmed.endsWith('.pdf') || trimmed.includes('.pdf?') || trimmed.startsWith('http');
  }
}
