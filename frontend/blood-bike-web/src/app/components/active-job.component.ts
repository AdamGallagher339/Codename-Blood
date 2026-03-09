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
    <div class="aj-page">
      <!-- Back -->
      <button class="btn-back" (click)="goBack()">‹ Jobs</button>

      <!-- No active job -->
      <div *ngIf="!activeJob" class="empty-card">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No Active Job</div>
        <div class="empty-sub">Accept a job from the Jobs page to get started.</div>
        <button class="btn-primary" (click)="goBack()">View Jobs</button>
      </div>

      <!-- Active job -->
      <ng-container *ngIf="activeJob">
        <!-- Status hero -->
        <div class="status-hero" [class]="'hero-' + activeJob.status">
          <span class="hero-icon">
            {{ activeJob.status === 'accepted' ? '📋' : activeJob.status === 'picked-up' ? '📦' : '✅' }}
          </span>
          <span class="hero-label">{{ statusLabel }}</span>
        </div>

        <!-- Job title -->
        <h2 class="aj-title">{{ activeJob.title }}</h2>

        <!-- Route card -->
        <div class="route-card">
          <div class="route-point pickup">
            <span class="route-dot"></span>
            <div class="route-info">
              <span class="route-label">Pickup</span>
              <span class="route-addr">{{ activeJob.pickup?.address || '—' }}</span>
            </div>
          </div>
          <div class="route-line"></div>
          <div class="route-point dropoff">
            <span class="route-dot"></span>
            <div class="route-info">
              <span class="route-label">Delivery</span>
              <span class="route-addr">{{ activeJob.dropoff?.address || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Details chips -->
        <div class="detail-chips">
          <div class="chip">
            <span class="chip-label">Dispatched by</span>
            <span class="chip-value">{{ activeJob.createdBy }}</span>
          </div>
          <div class="chip">
            <span class="chip-label">Created</span>
            <span class="chip-value">{{ activeJob.timestamps?.created | date:'shortTime' }}</span>
          </div>
          <div class="chip" *ngIf="activeJob.timestamps?.pickedUp">
            <span class="chip-label">Picked up</span>
            <span class="chip-value">{{ activeJob.timestamps!.pickedUp | date:'shortTime' }}</span>
          </div>
        </div>

        <!-- Action button -->
        <button
          *ngIf="activeJob.status === 'accepted'"
          class="btn-action pickup"
          (click)="onPickup()"
          [disabled]="processing"
        >
          <span class="action-icon">📦</span>
          <span class="action-label">Parcel Picked Up</span>
        </button>
        <button
          *ngIf="activeJob.status === 'picked-up'"
          class="btn-action deliver"
          (click)="onDelivered()"
          [disabled]="processing"
        >
          <span class="action-icon">✅</span>
          <span class="action-label">Parcel Delivered</span>
        </button>

        <!-- Timeline -->
        <div class="timeline">
          <div class="tl-step" [class.done]="true">
            <div class="tl-dot"></div>
            <div class="tl-body">
              <span class="tl-title">Accepted</span>
              <span class="tl-time">{{ activeJob.timestamps?.updated | date:'shortTime' }}</span>
            </div>
          </div>
          <div class="tl-step" [class.done]="activeJob.status === 'picked-up' || activeJob.status === 'delivered'">
            <div class="tl-dot"></div>
            <div class="tl-body">
              <span class="tl-title">Picked Up</span>
              <span class="tl-time">{{ activeJob.timestamps?.pickedUp ? (activeJob.timestamps.pickedUp | date:'shortTime') : 'Pending' }}</span>
            </div>
          </div>
          <div class="tl-step" [class.done]="activeJob.status === 'delivered'">
            <div class="tl-dot"></div>
            <div class="tl-body">
              <span class="tl-title">Delivered</span>
              <span class="tl-time">{{ activeJob.timestamps?.delivered ? (activeJob.timestamps.delivered | date:'shortTime') : 'Pending' }}</span>
            </div>
          </div>
        </div>
      </ng-container>

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
    .aj-page {
      padding: 1rem;
      max-width: 500px;
      margin: 0 auto;
    }

    /* ── Back ── */
    .btn-back {
      background: none;
      border: none;
      color: #888;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 0;
      margin-bottom: 1rem;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-back:hover { color: #fff; }

    /* ── Empty State ── */
    .empty-card {
      text-align: center;
      padding: 3rem 1.5rem;
      background: #1a1a1a;
      border-radius: 20px;
      border: 1px solid #2a2a2a;
    }
    .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
    .empty-title { font-size: 1.2rem; font-weight: 700; color: #ccc; margin-bottom: 0.35rem; }
    .empty-sub { font-size: 0.85rem; color: #666; margin-bottom: 1.25rem; }
    .btn-primary {
      padding: 10px 24px;
      border-radius: 20px;
      border: none;
      background: var(--color-red, #dc143c);
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
    }

    /* ── Status Hero ── */
    .status-hero {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 16px;
      margin-bottom: 1rem;
    }
    .hero-icon { font-size: 1.5rem; }
    .hero-label { font-weight: 700; font-size: 1rem; color: #fff; }
    .hero-accepted { background: linear-gradient(135deg, #1e3a5f, #1e40af); }
    .hero-picked-up { background: linear-gradient(135deg, #713f12, #a16207); }
    .hero-delivered { background: linear-gradient(135deg, #0d3320, #14532d); }

    /* ── Title ── */
    .aj-title {
      font-size: 1.3rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 1rem;
    }

    /* ── Route Card ── */
    .route-card {
      background: #1a1a1a;
      border-radius: 14px;
      padding: 16px;
      border: 1px solid #2a2a2a;
      margin-bottom: 1rem;
    }
    .route-point {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .route-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 3px;
    }
    .pickup .route-dot { background: #4ade80; }
    .dropoff .route-dot { background: var(--color-red, #dc143c); }
    .route-info { display: flex; flex-direction: column; }
    .route-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
    .route-addr { font-size: 0.9rem; color: #ccc; }
    .route-line {
      width: 2px;
      height: 16px;
      background: #333;
      margin-left: 5px;
    }

    /* ── Detail Chips ── */
    .detail-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .chip {
      display: flex;
      flex-direction: column;
      padding: 8px 14px;
      background: #1a1a1a;
      border-radius: 10px;
      border: 1px solid #2a2a2a;
      flex: 1;
      min-width: 100px;
    }
    .chip-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .chip-value { font-size: 0.85rem; color: #ccc; font-weight: 500; }

    /* ── Action Buttons ── */
    .btn-action {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 18px;
      border: none;
      border-radius: 16px;
      cursor: pointer;
      color: #fff;
      margin-bottom: 1.25rem;
      transition: transform 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-action:active:not(:disabled) { transform: scale(0.97); }
    .btn-action:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-action.pickup { background: linear-gradient(135deg, #d97706, #b45309); }
    .btn-action.deliver { background: linear-gradient(135deg, #16a34a, #15803d); }
    .action-icon { font-size: 1.5rem; }
    .action-label { font-size: 1.1rem; font-weight: 700; }

    /* ── Timeline ── */
    .timeline {
      padding: 16px;
      background: #1a1a1a;
      border-radius: 14px;
      border: 1px solid #2a2a2a;
    }
    .tl-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      position: relative;
    }
    .tl-step:not(:last-child) {
      padding-bottom: 20px;
    }
    .tl-step:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 7px;
      top: 26px;
      bottom: 0;
      width: 2px;
      background: #333;
    }
    .tl-step.done:not(:last-child)::after { background: #4ade80; }
    .tl-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #333;
      flex-shrink: 0;
    }
    .tl-step.done .tl-dot { background: #4ade80; }
    .tl-body { display: flex; flex-direction: column; }
    .tl-title { font-size: 0.85rem; font-weight: 600; color: #ccc; }
    .tl-time { font-size: 0.75rem; color: #666; }
    .tl-step.done .tl-title { color: #fff; }
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
