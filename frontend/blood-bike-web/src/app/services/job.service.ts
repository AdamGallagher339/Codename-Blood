import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Job, JobStatus, ReceiptRequest, ReceiptResponse, SavedContact } from '../models/job.model';

const SAVED_CONTACTS_KEY = 'bloodbike_saved_contacts';

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly _jobs = signal<Job[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly jobs = this._jobs.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly openJobs = computed(() => this._jobs().filter(j => j.status === 'open'));
  readonly myActiveJob = computed(() => {
    const username = this.auth.username?.() || '';
    return this._jobs().find(
      j => j.acceptedBy === username && (j.status === 'accepted' || j.status === 'picked-up')
    ) || null;
  });
  readonly myJobs = computed(() => {
    const username = this.auth.username?.() || '';
    return this._jobs().filter(j => j.acceptedBy === username && j.status !== 'open');
  });

  constructor(private http: HttpClient, private auth: AuthService) {}

  loadJobs(): void {
    this._loading.set(true);
    this._error.set(null);
    this.http.get<Job[]>('/api/jobs').subscribe({
      next: (jobs) => {
        this._jobs.set(jobs || []);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load jobs:', err);
        this._error.set('Failed to load jobs');
        this._jobs.set([]);
        this._loading.set(false);
      }
    });
  }

  getJob(jobId: string): void {
    this.http.get<Job>(`/api/jobs/${jobId}`).subscribe({
      next: (job) => {
        this._jobs.update(jobs => {
          const idx = jobs.findIndex(j => j.jobId === jobId);
          if (idx >= 0) {
            const updated = [...jobs];
            updated[idx] = job;
            return updated;
          }
          return [...jobs, job];
        });
      },
      error: (err) => console.error('Failed to get job:', err)
    });
  }

  acceptJob(job: Job): Promise<Job> {
    const username = this.auth.username?.() || '';
    const payload = { status: 'accepted' as JobStatus, acceptedBy: username };
    return new Promise((resolve, reject) => {
      this.http.put<Job>(`/api/jobs/${job.jobId}`, payload).subscribe({
        next: (updated) => {
          this._jobs.update(jobs => jobs.map(j => j.jobId === job.jobId ? updated : j));
          resolve(updated);
        },
        error: (err) => {
          console.error('Failed to accept job:', err);
          reject(err);
        }
      });
    });
  }

  updateJobStatus(jobId: string, status: JobStatus, signatureData?: string): Promise<Job> {
    const payload: any = { status };
    if (signatureData) {
      payload.signatureData = signatureData;
    }
    return new Promise((resolve, reject) => {
      this.http.put<Job>(`/api/jobs/${jobId}`, payload).subscribe({
        next: (updated) => {
          this._jobs.update(jobs => jobs.map(j => j.jobId === jobId ? updated : j));
          resolve(updated);
        },
        error: (err) => {
          console.error(`Failed to update job status to ${status}:`, err);
          reject(err);
        }
      });
    });
  }

  sendReceipt(request: ReceiptRequest): Promise<ReceiptResponse> {
    return new Promise((resolve, reject) => {
      this.http.post<ReceiptResponse>('/api/jobs/receipt', request).subscribe({
        next: (res) => resolve(res),
        error: (err) => {
          console.error('Failed to send receipt:', err);
          reject(err);
        }
      });
    });
  }

  // --- Saved contacts (localStorage) ---
  getSavedContacts(): SavedContact[] {
    try {
      const raw = localStorage.getItem(SAVED_CONTACTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveContact(contact: SavedContact): void {
    const contacts = this.getSavedContacts();
    const existing = contacts.findIndex(c => c.email === contact.email);
    if (existing >= 0) {
      contacts[existing] = contact;
    } else {
      contacts.push(contact);
    }
    localStorage.setItem(SAVED_CONTACTS_KEY, JSON.stringify(contacts));
  }

  removeContact(email: string): void {
    const contacts = this.getSavedContacts().filter(c => c.email !== email);
    localStorage.setItem(SAVED_CONTACTS_KEY, JSON.stringify(contacts));
  }
}
