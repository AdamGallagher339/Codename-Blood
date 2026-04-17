import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssueReportService } from '../services/issue-report.service';
import { IssueReport, IssueType } from '../models/issue-report.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-issue-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1>Issue Reports</h1>
        <p>Report and track bike issues — minor faults to major breakdowns.</p>
        <div class="stats">
          <div class="stat"><span class="stat-value">{{ totalReports() }}</span><span class="stat-label">Total</span></div>
          <div class="stat"><span class="stat-value">{{ openReports() }}</span><span class="stat-label">Open</span></div>
          <div class="stat"><span class="stat-value">{{ resolvedReports() }}</span><span class="stat-label">Resolved</span></div>
        </div>
      </header>

      <!-- Report Form -->
      <section class="section" *ngIf="showForm()">
        <h2>File New Report</h2>
        <div class="form-row">
          <div class="field">
            <label>Bike ID</label>
            <input type="text" [(ngModel)]="formBikeId" placeholder="e.g. BB21-WES" />
          </div>
          <div class="field">
            <label>Severity</label>
            <select [(ngModel)]="formType">
              <option value="Minor">Minor</option>
              <option value="Major">Major</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:12px">
          <label>Description</label>
          <textarea [(ngModel)]="formDescription" rows="3" placeholder="Describe the issue..."></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-primary" [disabled]="!formBikeId || !formDescription" (click)="submitReport()">Submit Report</button>
          <button class="btn-secondary" (click)="showForm.set(false)">Cancel</button>
        </div>
      </section>

      <button *ngIf="!showForm()" class="btn-primary" (click)="showForm.set(true)">+ New Report</button>

      <!-- Filter -->
      <div class="filter-bar">
        <button [class.active]="filter() === 'all'" (click)="filter.set('all')">All</button>
        <button [class.active]="filter() === 'open'" (click)="filter.set('open')">Open</button>
        <button [class.active]="filter() === 'resolved'" (click)="filter.set('resolved')">Resolved</button>
      </div>

      <!-- Report List -->
      <section class="section">
        <div class="report-list" *ngIf="filteredReports().length; else noReports">
          <div class="report-card" *ngFor="let r of filteredReports()" [class.resolved]="r.resolved">
            <div class="report-header">
              <strong>{{ r.bikeId }}</strong>
              <div class="badges">
                <span class="badge" [class.badge-major]="r.type === 'Major'" [class.badge-minor]="r.type === 'Minor'">{{ r.type }}</span>
                <span class="badge" [class.badge-open]="!r.resolved" [class.badge-resolved]="r.resolved">
                  {{ r.resolved ? 'Resolved' : 'Open' }}
                </span>
              </div>
            </div>
            <p class="report-desc">{{ r.description }}</p>
            <div class="report-meta">
              <span>Reported by: {{ r.riderId }}</span>
              <span>{{ r.timestamp | date:'medium' }}</span>
            </div>
            <div class="report-actions" *ngIf="!r.resolved">
              <button class="btn-resolve" (click)="resolve(r.issueId)">Mark Resolved</button>
            </div>
          </div>
        </div>
        <ng-template #noReports>
          <p class="empty">No issue reports match the current filter.</p>
        </ng-template>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .page-header h1 { margin: 0 0 4px; }
    .page-header p { margin: 0 0 16px; color: #666; }
    .stats { display: flex; gap: 20px; }
    .stat { background: #f8f9fa; padding: 12px 20px; border-radius: 8px; text-align: center; }
    .stat-value { display: block; font-size: 1.5rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #666; }
    .section { margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .field { flex: 1; min-width: 150px; }
    .field label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 0.85rem; }
    .field input, .field select, .field textarea { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit; }
    .form-actions { margin-top: 12px; display: flex; gap: 8px; }
    .btn-primary { padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-resolve { padding: 6px 12px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
    .btn-resolve:hover { background: #15803d; }
    .filter-bar { display: flex; gap: 8px; margin: 16px 0; }
    .filter-bar button { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 20px; background: #fff; cursor: pointer; font-size: 0.85rem; }
    .filter-bar button.active { background: #2563eb; color: white; border-color: #2563eb; }
    .report-list { display: flex; flex-direction: column; gap: 12px; }
    .report-card { padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; }
    .report-card.resolved { opacity: 0.7; }
    .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .badges { display: flex; gap: 6px; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .badge-major { background: #fef2f2; color: #991b1b; }
    .badge-minor { background: #fefce8; color: #854d0e; }
    .badge-open { background: #fff7ed; color: #9a3412; }
    .badge-resolved { background: #dcfce7; color: #166534; }
    .report-desc { margin: 4px 0 8px; color: #333; }
    .report-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.85rem; color: #555; }
    .report-actions { margin-top: 8px; }
    .empty { color: #999; font-style: italic; }
  `]
})
export class IssueReportsComponent {
  private reportService = inject(IssueReportService);
  private auth = inject(AuthService);

  reports = this.reportService.getReports();
  showForm = signal(false);
  filter = signal<'all' | 'open' | 'resolved'>('all');

  formBikeId = '';
  formType: IssueType = 'Minor';
  formDescription = '';

  totalReports = computed(() => this.reports().length);
  openReports = computed(() => this.reports().filter(r => !r.resolved).length);
  resolvedReports = computed(() => this.reports().filter(r => r.resolved).length);

  filteredReports = computed(() => {
    const f = this.filter();
    let list = this.reports();
    if (f === 'open') list = list.filter(r => !r.resolved);
    if (f === 'resolved') list = list.filter(r => r.resolved);
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  submitReport(): void {
    this.reportService.createReport({
      bikeId: this.formBikeId,
      riderId: this.auth.username(),
      type: this.formType,
      description: this.formDescription,
    }).subscribe((ok) => {
      if (ok) {
        this.formBikeId = '';
        this.formType = 'Minor';
        this.formDescription = '';
        this.showForm.set(false);
      }
    });
  }

  resolve(issueId: string): void {
    this.reportService.resolveReport(issueId).subscribe();
  }
}
