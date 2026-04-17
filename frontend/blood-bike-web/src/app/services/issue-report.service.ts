import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { IssueReport, CreateIssueReportDto } from '../models/issue-report.model';
import { NotificationService } from './notification.service';

type ApiIssueReport = Omit<IssueReport, 'timestamp'> & {
  timestamp: string;
};

@Injectable({
  providedIn: 'root'
})
export class IssueReportService {
  private reports = signal<IssueReport[]>([]);
  private loaded = false;
  private notifications = inject(NotificationService);

  constructor(private http: HttpClient) {}

  getReports() {
    if (!this.loaded) {
      this.loaded = true;
      this.loadReports();
    }
    return this.reports.asReadonly();
  }

  createReport(dto: CreateIssueReportDto): Observable<boolean> {
    return this.http
      .post<ApiIssueReport>('/api/issue-reports', dto)
      .pipe(
        map((r) => this.fromApi(r)),
        tap((created) => {
          this.reports.update((list) => [...list, created]);
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to create issue report', err);
          this.notifications.error('Could not submit the issue report.', 'issue-reports:create');
          return of(false);
        })
      );
  }

  resolveReport(issueId: string): Observable<boolean> {
    return this.http
      .put<ApiIssueReport>(`/api/issue-reports/${issueId}`, {})
      .pipe(
        map((r) => this.fromApi(r)),
        tap((updated) => {
          this.reports.update((list) =>
            list.map((r) => (r.issueId === issueId ? updated : r))
          );
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to resolve issue report', err);
          this.notifications.error('Could not resolve the issue.', 'issue-reports:resolve');
          return of(false);
        })
      );
  }

  deleteReport(issueId: string): Observable<boolean> {
    return this.http
      .delete(`/api/issue-reports/${issueId}`)
      .pipe(
        tap(() => {
          this.reports.update((list) => list.filter((r) => r.issueId !== issueId));
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to delete issue report', err);
          this.notifications.error('Could not delete the issue report.', 'issue-reports:delete');
          return of(false);
        })
      );
  }

  private loadReports(): void {
    this.http
      .get<ApiIssueReport[]>('/api/issue-reports')
      .pipe(
        map((items) => items.map((r) => this.fromApi(r))),
        catchError((err) => {
          console.error('Failed to load issue reports', err);
          this.notifications.warning('Issue report data could not be refreshed.', 'issue-reports:load');
          return of(null);
        })
      )
      .subscribe((reports) => {
        if (!reports) return;
        this.reports.set(reports);
      });
  }

  private fromApi(r: ApiIssueReport): IssueReport {
    return {
      ...r,
      timestamp: new Date(r.timestamp),
    };
  }
}
