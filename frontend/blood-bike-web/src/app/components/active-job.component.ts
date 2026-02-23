import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JobService } from '../services/job.service';
import { AuthService } from '../services/auth.service';
import { ReceiptDialogComponent, ReceiptType } from './receipt-dialog.component';
import { Job } from '../models/job.model';

@Component({
  selector: 'app-active-job',
  standalone: true,
  imports: [CommonModule, ReceiptDialogComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>🏍️ Active Job</h1>
        <button class="back-btn" (click)="goBack()">← Back to Jobs</button>
      </div>

      <!-- No active job -->
      <div *ngIf="!activeJob" class="no-job-card">
        <div class="no-job-icon">📭</div>
        <h2>No Active Job</h2>
        <p>You don't have an active job right now. Go to the Jobs page to accept one.</p>
        <button class="btn-primary" (click)="goBack()">View Available Jobs</button>
      </div>

      <!-- Active job card -->
      <div *ngIf="activeJob" class="job-card">
        <!-- Status banner -->
        <div class="status-banner" [class]="'status-' + activeJob.status">
          <span class="status-icon">
            {{ activeJob.status === 'accepted' ? '📋' : activeJob.status === 'picked-up' ? '📦' : '✅' }}
          </span>
          <span class="status-text">{{ statusLabel }}</span>
        </div>

        <!-- Job details -->
        <div class="job-details">
          <h2 class="job-title">{{ activeJob.title }}</h2>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">📍 Pickup</span>
              <span class="detail-value">{{ activeJob.pickup?.address || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">🏁 Delivery</span>
              <span class="detail-value">{{ activeJob.dropoff?.address || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">👤 Dispatched By</span>
              <span class="detail-value">{{ activeJob.createdBy }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">🕐 Created</span>
              <span class="detail-value">{{ activeJob.timestamps?.created | date:'medium' }}</span>
            </div>
            <div class="detail-item" *ngIf="activeJob.timestamps?.pickedUp">
              <span class="detail-label">📦 Picked Up</span>
              <span class="detail-value">{{ activeJob.timestamps.pickedUp | date:'medium' }}</span>
            </div>
          </div>
        </div>

        <!-- Map placeholder -->
        <div class="map-placeholder">
          <div class="map-icon">🗺️</div>
          <p>Delivery route will be displayed here</p>
        </div>

        <!-- Action buttons -->
        <div class="action-buttons">
          <!-- Pickup button: shown when status is 'accepted' -->
          <button
            *ngIf="activeJob.status === 'accepted'"
            class="action-btn pickup-btn"
            (click)="onPickup()"
            [disabled]="processing"
          >
            <span class="btn-icon">📦</span>
            <span class="btn-label">Parcel Picked Up</span>
            <span class="btn-hint">Confirm you have collected the parcel</span>
          </button>

          <!-- Delivered button: shown when status is 'picked-up' -->
          <button
            *ngIf="activeJob.status === 'picked-up'"
            class="action-btn delivered-btn"
            (click)="onDelivered()"
            [disabled]="processing"
          >
            <span class="btn-icon">✅</span>
            <span class="btn-label">Parcel Delivered</span>
            <span class="btn-hint">Confirm you have delivered the parcel</span>
          </button>
        </div>

        <!-- Timeline -->
        <div class="timeline">
          <div class="timeline-item" [class.done]="true">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <strong>Job Accepted</strong>
              <span>{{ activeJob.timestamps?.updated | date:'short' }}</span>
            </div>
          </div>
          <div class="timeline-item" [class.done]="activeJob.status === 'picked-up' || activeJob.status === 'delivered'">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <strong>Parcel Picked Up</strong>
              <span>{{ activeJob.timestamps?.pickedUp ? (activeJob.timestamps.pickedUp | date:'short') : 'Pending' }}</span>
            </div>
          </div>
          <div class="timeline-item" [class.done]="activeJob.status === 'delivered'">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <strong>Parcel Delivered</strong>
              <span>{{ activeJob.timestamps?.delivered ? (activeJob.timestamps.delivered | date:'short') : 'Pending' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Receipt dialog -->
      <app-receipt-dialog
        *ngIf="showReceiptDialog && activeJob"
        [job]="activeJob"
        [type]="receiptType"
        (close)="showReceiptDialog = false"
        (completed)="onReceiptCompleted($event)"
      ></app-receipt-dialog>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 16px;
      max-width: 600px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .page-header h1 { margin: 0; font-size: 1.4em; }
    .back-btn {
      padding: 8px 16px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9em;
    }
    .back-btn:hover { background: #5a6268; }

    .no-job-card {
      text-align: center;
      padding: 40px 20px;
      background: #f8f9fa;
      border-radius: 12px;
      border: 2px dashed #ddd;
    }
    .no-job-icon { font-size: 3em; margin-bottom: 12px; }
    .no-job-card h2 { margin: 0 0 8px; color: #555; }
    .no-job-card p { color: #777; margin-bottom: 20px; }
    .btn-primary {
      padding: 12px 24px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1em;
      font-weight: 600;
    }
    .btn-primary:hover { background: #c82333; }

    .job-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .status-banner {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-weight: 600;
      font-size: 1.1em;
    }
    .status-accepted { background: #007bff; }
    .status-picked-up { background: #fd7e14; }
    .status-delivered { background: #28a745; }
    .status-icon { font-size: 1.3em; }

    .job-details { padding: 20px; }
    .job-title { margin: 0 0 16px; font-size: 1.3em; color: #333; }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .detail-item {
      display: flex;
      flex-direction: column;
      background: #f8f9fa;
      padding: 10px 14px;
      border-radius: 8px;
    }
    .detail-label { font-size: 0.85em; color: #666; font-weight: 600; margin-bottom: 2px; }
    .detail-value { font-size: 1em; color: #333; }

    .map-placeholder {
      margin: 0 20px;
      padding: 30px;
      background: #e9ecef;
      border-radius: 8px;
      text-align: center;
      color: #888;
      border: 2px dashed #ccc;
    }
    .map-icon { font-size: 2em; margin-bottom: 8px; }
    .map-placeholder p { margin: 0; font-size: 0.95em; }

    .action-buttons {
      padding: 20px;
    }
    .action-btn {
      width: 100%;
      padding: 18px 20px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
      color: white;
    }
    .action-btn:active { transform: scale(0.98); }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pickup-btn { background: linear-gradient(135deg, #fd7e14, #e06900); }
    .pickup-btn:hover:not(:disabled) { background: linear-gradient(135deg, #e06900, #c05800); }
    .delivered-btn { background: linear-gradient(135deg, #28a745, #1e7e34); }
    .delivered-btn:hover:not(:disabled) { background: linear-gradient(135deg, #1e7e34, #155d27); }
    .btn-icon { font-size: 2em; }
    .btn-label { font-size: 1.2em; font-weight: 700; }
    .btn-hint { font-size: 0.85em; opacity: 0.9; }

    .timeline {
      padding: 20px;
      border-top: 1px solid #eee;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 0;
      position: relative;
    }
    .timeline-item:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 8px;
      top: 28px;
      bottom: -8px;
      width: 2px;
      background: #ddd;
    }
    .timeline-item.done:not(:last-child)::after { background: #28a745; }
    .timeline-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ddd;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .timeline-item.done .timeline-dot { background: #28a745; }
    .timeline-content {
      display: flex;
      flex-direction: column;
      font-size: 0.95em;
    }
    .timeline-content strong { color: #333; }
    .timeline-content span { color: #888; font-size: 0.88em; }

    @media (min-width: 500px) {
      .detail-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class ActiveJobComponent implements OnInit, OnDestroy {
  activeJob: Job | null = null;
  processing = false;
  showReceiptDialog = false;
  receiptType: ReceiptType = 'pickup';
  private refreshInterval: any;

  get statusLabel(): string {
    switch (this.activeJob?.status) {
      case 'accepted': return 'En Route to Pickup';
      case 'picked-up': return 'Parcel Collected — En Route to Delivery';
      case 'delivered': return 'Delivered';
      default: return this.activeJob?.status || '';
    }
  }

  constructor(
    private jobService: JobService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.jobService.loadJobs();
    // Poll for job updates every 15 seconds
    this.refreshInterval = setInterval(() => {
      this.jobService.loadJobs();
    }, 15000);

    // Watch for reactive updates
    this.checkForActiveJob();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private checkForActiveJob(): void {
    // Use a simple interval to check signal changes
    const check = setInterval(() => {
      const job = this.jobService.myActiveJob();
      if (job) {
        this.activeJob = job;
      } else if (this.activeJob && (this.activeJob.status === 'delivered' || this.activeJob.status === 'completed')) {
        // Job was completed, keep showing until user navigates away
      } else {
        this.activeJob = this.jobService.myActiveJob();
      }
    }, 500);

    // Clean up on destroy
    const origDestroy = this.ngOnDestroy.bind(this);
    this.ngOnDestroy = () => {
      clearInterval(check);
      origDestroy();
    };
  }

  goBack(): void {
    this.router.navigate(['/jobs']);
  }

  onPickup(): void {
    this.receiptType = 'pickup';
    this.showReceiptDialog = true;
  }

  onDelivered(): void {
    this.receiptType = 'delivery';
    this.showReceiptDialog = true;
  }

  async onReceiptCompleted(event: { type: ReceiptType; signatureData: string }): Promise<void> {
    if (!this.activeJob) return;
    this.showReceiptDialog = false;
    this.processing = true;

    try {
      const newStatus = event.type === 'pickup' ? 'picked-up' : 'delivered';
      const updated = await this.jobService.updateJobStatus(
        this.activeJob.jobId,
        newStatus,
        event.signatureData
      );
      this.activeJob = updated;

      // If delivered, show success briefly then redirect
      if (newStatus === 'delivered') {
        setTimeout(() => {
          this.router.navigate(['/jobs']);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to update job status:', err);
      alert('Failed to update job status. Please try again.');
    } finally {
      this.processing = false;
    }
  }
}
