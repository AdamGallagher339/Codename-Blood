import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignaturePadComponent } from './signature-pad.component';
import { Job, SavedContact } from '../models/job.model';
import { JobService } from '../services/job.service';
import { AuthService } from '../services/auth.service';

export type ReceiptType = 'pickup' | 'delivery';

@Component({
  selector: 'app-receipt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, SignaturePadComponent],
  template: `
    <div class="dialog-overlay" (click)="onOverlayClick($event)">
      <div class="dialog-content">
        <div class="dialog-header" [class.delivery]="type === 'delivery'">
          <h2>{{ type === 'pickup' ? '📦 Pickup Confirmation' : '✅ Delivery Confirmation' }}</h2>
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        <div class="dialog-body">
          <!-- Step 1: Signature -->
          <div *ngIf="step === 'signature'" class="step">
            <div class="job-summary">
              <div class="summary-row"><span class="label">Job:</span><span>{{ job.title }}</span></div>
              <div class="summary-row"><span class="label">Pickup:</span><span>{{ job.pickup?.address || '—' }}</span></div>
              <div class="summary-row"><span class="label">Delivery:</span><span>{{ job.dropoff?.address || '—' }}</span></div>
              <div class="summary-row"><span class="label">Time:</span><span>{{ currentTime }}</span></div>
            </div>
            <app-signature-pad
              [label]="type === 'pickup' ? 'Sign to confirm pickup' : 'Sign to confirm delivery'"
              (signed)="onSigned($event)"
            ></app-signature-pad>
          </div>

          <!-- Step 2: Email recipient -->
          <div *ngIf="step === 'email'" class="step">
            <div class="signature-preview">
              <p class="preview-label">Signature captured ✓</p>
              <img [src]="signatureData" alt="Signature" class="sig-preview-img" />
            </div>

            <div class="email-section">
              <h3>Send Receipt To</h3>

              <div *ngIf="savedContacts.length > 0" class="saved-contacts">
                <label class="section-label">Saved Contacts</label>
                <div class="contact-list">
                  <button
                    *ngFor="let c of savedContacts"
                    class="contact-chip"
                    [class.selected]="recipientEmail === c.email"
                    (click)="selectContact(c)"
                  >
                    {{ c.name || c.email }}
                  </button>
                </div>
              </div>

              <div class="new-email">
                <label class="section-label">Or enter a new email</label>
                <input
                  type="email"
                  [(ngModel)]="recipientEmail"
                  placeholder="recipient@example.com"
                  class="email-input"
                />
                <div class="save-contact-row" *ngIf="recipientEmail && !isExistingContact()">
                  <label>
                    <input type="checkbox" [(ngModel)]="saveAsContact" />
                    Save this contact
                  </label>
                  <input
                    *ngIf="saveAsContact"
                    type="text"
                    [(ngModel)]="contactName"
                    placeholder="Contact name"
                    class="contact-name-input"
                  />
                </div>
              </div>

              <div class="email-actions">
                <button class="btn-back" (click)="step = 'signature'">← Back</button>
                <button
                  class="btn-send"
                  [disabled]="!recipientEmail || sending"
                  (click)="sendReceipt()"
                >
                  {{ sending ? 'Sending…' : '📧 Send Receipt' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: Done -->
          <div *ngIf="step === 'done'" class="step done-step">
            <div class="done-icon">{{ sendResult?.sent ? '✅' : '⚠️' }}</div>
            <p class="done-message">{{ sendResult?.message }}</p>
            <div *ngIf="sendResult && !sendResult.sent && sendResult.html" class="fallback-note">
              <p>The receipt was generated but email delivery failed. You can copy the receipt below.</p>
              <button class="btn-copy" (click)="copyReceipt()">📋 Copy Receipt HTML</button>
            </div>
            <button class="btn-done" (click)="onDone()">Done</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .dialog-content {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .dialog-header {
      background: #dc3545;
      color: white;
      padding: 16px 20px;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dialog-header.delivery { background: #28a745; }
    .dialog-header h2 { margin: 0; font-size: 1.2em; }
    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.5em;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .dialog-body { padding: 20px; }
    .step { animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .job-summary {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 0.95em;
    }
    .summary-row .label { font-weight: 600; color: #555; }

    .signature-preview {
      text-align: center;
      margin-bottom: 16px;
    }
    .preview-label { color: #28a745; font-weight: 600; margin-bottom: 8px; }
    .sig-preview-img {
      max-width: 200px;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 4px;
    }

    .email-section h3 { margin: 0 0 12px; font-size: 1.05em; }
    .section-label { display: block; font-weight: 600; font-size: 0.9em; color: #555; margin-bottom: 6px; }
    .saved-contacts { margin-bottom: 16px; }
    .contact-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .contact-chip {
      padding: 8px 14px;
      border: 2px solid #ddd;
      border-radius: 20px;
      background: #f8f9fa;
      cursor: pointer;
      font-size: 0.9em;
      transition: all 0.15s;
    }
    .contact-chip:hover { border-color: #dc3545; }
    .contact-chip.selected { border-color: #dc3545; background: #dc3545; color: white; }

    .new-email { margin-bottom: 16px; }
    .email-input {
      width: 100%;
      padding: 10px 12px;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-size: 1em;
      box-sizing: border-box;
    }
    .email-input:focus { border-color: #dc3545; outline: none; }
    .save-contact-row {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .save-contact-row label { display: flex; align-items: center; gap: 6px; font-size: 0.9em; cursor: pointer; }
    .contact-name-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.9em;
    }

    .email-actions {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .btn-back {
      padding: 10px 20px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95em;
    }
    .btn-back:hover { background: #5a6268; }
    .btn-send {
      padding: 10px 20px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95em;
      font-weight: 600;
      flex: 1;
    }
    .btn-send:hover:not(:disabled) { background: #c82333; }
    .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .done-step { text-align: center; padding: 20px 0; }
    .done-icon { font-size: 3em; margin-bottom: 12px; }
    .done-message { font-size: 1.1em; color: #333; margin-bottom: 20px; }
    .fallback-note { background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .fallback-note p { margin: 0 0 8px; font-size: 0.9em; }
    .btn-copy {
      padding: 8px 16px;
      background: #ffc107;
      color: #333;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-done {
      padding: 12px 40px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1.05em;
      font-weight: 600;
    }
    .btn-done:hover { background: #218838; }
  `]
})
export class ReceiptDialogComponent {
  @Input() job!: Job;
  @Input() type: ReceiptType = 'pickup';
  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<{ type: ReceiptType; signatureData: string }>();

  step: 'signature' | 'email' | 'done' = 'signature';
  signatureData = '';
  recipientEmail = '';
  savedContacts: SavedContact[] = [];
  saveAsContact = false;
  contactName = '';
  sending = false;
  sendResult: { sent: boolean; message: string; html?: string } | null = null;

  get currentTime(): string {
    return new Date().toLocaleString();
  }

  constructor(private jobService: JobService, private auth: AuthService) {
    this.savedContacts = this.jobService.getSavedContacts();
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.close.emit();
    }
  }

  onSigned(dataUrl: string): void {
    this.signatureData = dataUrl;
    this.step = 'email';
  }

  selectContact(contact: SavedContact): void {
    this.recipientEmail = contact.email;
  }

  isExistingContact(): boolean {
    return this.savedContacts.some(c => c.email === this.recipientEmail);
  }

  async sendReceipt(): Promise<void> {
    if (!this.recipientEmail || this.sending) return;
    this.sending = true;

    // Save contact if requested
    if (this.saveAsContact && !this.isExistingContact()) {
      this.jobService.saveContact({
        name: this.contactName || this.recipientEmail,
        email: this.recipientEmail
      });
    }

    try {
      const result = await this.jobService.sendReceipt({
        jobId: this.job.jobId,
        type: this.type,
        recipientEmail: this.recipientEmail,
        riderName: this.auth.username?.() || 'Unknown Rider',
        signatureData: this.signatureData,
        jobTitle: this.job.title,
        pickupAddress: this.job.pickup?.address || '—',
        dropoffAddress: this.job.dropoff?.address || '—',
        timestamp: new Date().toISOString()
      });
      this.sendResult = result;
      this.step = 'done';
    } catch (err: any) {
      this.sendResult = {
        sent: false,
        message: `Error: ${err?.error?.message || err?.message || 'Unknown error'}`
      };
      this.step = 'done';
    } finally {
      this.sending = false;
    }
  }

  copyReceipt(): void {
    if (this.sendResult?.html) {
      navigator.clipboard.writeText(this.sendResult.html).then(() => {
        alert('Receipt HTML copied to clipboard');
      }).catch(() => {
        alert('Failed to copy');
      });
    }
  }

  onDone(): void {
    this.completed.emit({ type: this.type, signatureData: this.signatureData });
  }
}
