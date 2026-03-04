import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  applicationPdf?: string;
  motorcycleExperienceYears: number;
  availableFreeTimePerWeek: string;
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
                <button class="btn-view-pdf" type="button" *ngIf="getApplicationPdfUrl(app)" (click)="openApplicationPdf(app)">View PDF</button>
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
                  <button class="btn-delete" *ngIf="app.status === 'denied'" (click)="deleteApplication(app)">Delete</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filteredApplications.length === 0">
              <td colspan="6" class="empty">No applications found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pdf-modal-backdrop" *ngIf="selectedApplicationPdf" (click)="closePdfPopup()">
        <div class="pdf-modal" (click)="$event.stopPropagation()">
          <div class="pdf-modal-header">
            <div class="pdf-title-wrap">
              <p class="pdf-eyebrow">Application Document</p>
              <h2>{{ selectedApplicationName }}</h2>
            </div>
            <button type="button" class="btn-close" (click)="closePdfPopup()" aria-label="Close PDF preview">✕</button>
          </div>
          <div class="pdf-modal-body">
            <iframe [src]="selectedApplicationPdf" title="Application PDF"></iframe>
          </div>
          <div class="pdf-modal-footer">
            <a class="btn-link" *ngIf="selectedApplicationPdfHref" [href]="selectedApplicationPdfHref" target="_blank" rel="noopener noreferrer">Open in new tab</a>
            <button type="button" class="btn-close-modal" (click)="closePdfPopup()">Close</button>
          </div>
        </div>
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
    .btn-view-pdf {
      padding: 0.35rem 0.7rem;
      border: 1px solid #cfd8e3;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .btn-view-pdf:hover { background: #f4f7fb; }

    .action-btns button {
      padding: 0.3rem 0.6rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;
    }
    .btn-accept { background: #28a745; color: #fff; }
    .btn-reject { background: #dc3545; color: #fff; }
    .btn-delete { background: #6b7280; color: #fff; }
    .btn-accept:hover { background: #218838; }
    .btn-reject:hover { background: #c82333; }
    .btn-delete:hover { background: #4b5563; }

    .pdf-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1.25rem;
    }

    .pdf-modal {
      width: min(1040px, 100%);
      height: min(92vh, 920px);
      background: #fff;
      border-radius: 14px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .pdf-modal-header,
    .pdf-modal-footer {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .pdf-modal-footer {
      border-bottom: none;
      border-top: 1px solid #eee;
      justify-content: flex-end;
    }

    .pdf-modal-header h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: #0f172a;
    }

    .pdf-title-wrap {
      min-width: 0;
    }

    .pdf-eyebrow {
      margin: 0 0 0.2rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }

    .btn-close {
      border: 1px solid #dbe2ea;
      background: #fff;
      width: 2rem;
      height: 2rem;
      border-radius: 999px;
      font-size: 1rem;
      cursor: pointer;
      line-height: 1;
      flex: 0 0 auto;
    }
    .btn-close:hover { background: #f8fafc; }

    .btn-link,
    .btn-close-modal {
      border-radius: 8px;
      padding: 0.45rem 0.8rem;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    .btn-link {
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
    }
    .btn-link:hover { background: #dbeafe; }

    .btn-close-modal {
      border: 1px solid #d1d5db;
      background: #fff;
      color: #111827;
    }
    .btn-close-modal:hover { background: #f3f4f6; }

    .pdf-modal-body {
      min-height: 0;
      padding: 0.85rem 1rem 1rem;
      background: #f8fafc;
    }

    .pdf-modal-body iframe {
      width: 100%;
      height: 100%;
      border: 1px solid #dbe2ea;
      border-radius: 10px;
      display: block;
      background: #fff;
    }

    @media (max-width: 768px) {
      .pdf-modal {
        height: 95vh;
        border-radius: 12px;
      }

      .pdf-modal-body {
        padding: 0.65rem;
      }

      .pdf-modal-footer {
        justify-content: space-between;
      }
    }
  `]
})
export class ApplicationsComponent implements OnInit {
  applications: Application[] = [];
  filterStatus = '';
  searchQuery = '';
  selectedApplicationPdf: SafeResourceUrl | null = null;
  selectedApplicationPdfHref: string | null = null;
  selectedApplicationName = '';

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

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

  deleteApplication(app: Application): void {
    this.http.delete(`/api/applications/${app.id}`).subscribe({
      next: () => {
        this.applications = this.applications.filter(existing => existing.id !== app.id);
      }
    });
  }

  getApplicationPdfUrl(app: Application): string | null {
    const candidates = [app.applicationPdf, app.application];
    for (const candidate of candidates) {
      const normalized = this.normalizeApplicationPdfUrl(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  openApplicationPdf(app: Application): void {
    const pdfUrl = this.getApplicationPdfUrl(app);
    if (!pdfUrl) {
      return;
    }
    this.selectedApplicationName = app.name;
    this.selectedApplicationPdfHref = pdfUrl;
    this.selectedApplicationPdf = this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl);
  }

  closePdfPopup(): void {
    this.selectedApplicationPdf = null;
    this.selectedApplicationPdfHref = null;
    this.selectedApplicationName = '';
  }

  private looksLikePdfUrl(value: string): boolean {
    const trimmed = (value || '').trim().toLowerCase();
    return (
      trimmed.startsWith('data:application/pdf') ||
      trimmed.endsWith('.pdf') ||
      trimmed.includes('.pdf?') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://')
    );
  }

  private normalizeApplicationPdfUrl(value: string | undefined): string | null {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return null;
    }

    const lower = trimmed.toLowerCase();

    if (lower.startsWith('data:application/pdf')) {
      return trimmed;
    }

    // Legacy records can contain raw base64-encoded PDF bytes without a data URI prefix.
    if (/^jvberi0/i.test(trimmed)) {
      return `data:application/pdf;base64,${trimmed}`;
    }

    if (this.looksLikePdfUrl(trimmed)) {
      return trimmed;
    }

    return null;
  }
}
