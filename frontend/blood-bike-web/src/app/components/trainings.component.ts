import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Training {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  trainer: string;
  capacity: number;
  enrolled: number;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
}

@Component({
  selector: 'app-trainings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="trainings-page">
      <header class="page-header">
        <div>
          <h1>Trainings</h1>
          <p>Schedule, track, and complete volunteer training sessions.</p>
        </div>
        <button *ngIf="!showCreateForm" class="btn-add" (click)="showCreateForm = true">+ Schedule Training</button>
      </header>

      <section class="stats-row">
        <article class="stat-card upcoming">
          <span>Upcoming</span>
          <strong>{{ upcomingCount }}</strong>
        </article>
        <article class="stat-card in-progress">
          <span>In Progress</span>
          <strong>{{ inProgressCount }}</strong>
        </article>
        <article class="stat-card completed">
          <span>Completed</span>
          <strong>{{ completedCount }}</strong>
        </article>
      </section>

      <section class="create-section" *ngIf="showCreateForm">
        <h2>Schedule New Training</h2>
        <form (ngSubmit)="createTraining()" class="training-form">
          <label>
            <span>Title</span>
            <input type="text" [(ngModel)]="newTraining.title" name="title" placeholder="Training title" required />
          </label>
          <label>
            <span>Description</span>
            <textarea [(ngModel)]="newTraining.description" name="description" placeholder="Training description" rows="3"></textarea>
          </label>
          <div class="form-row">
            <label>
              <span>Date and Time</span>
              <input type="datetime-local" [(ngModel)]="newTraining.date" name="date" required />
            </label>
            <label>
              <span>Location</span>
              <input type="text" [(ngModel)]="newTraining.location" name="location" placeholder="e.g. HQ Training Room" />
            </label>
          </div>
          <div class="form-row">
            <label>
              <span>Trainer</span>
              <input type="text" [(ngModel)]="newTraining.trainer" name="trainer" placeholder="Trainer name" />
            </label>
            <label>
              <span>Capacity</span>
              <input type="number" [(ngModel)]="newTraining.capacity" name="capacity" min="1" />
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-create">Schedule Training</button>
            <button type="button" class="btn-cancel" (click)="showCreateForm = false">Cancel</button>
          </div>
        </form>
      </section>

      <section class="toolbar">
        <label>
          Status
          <select [(ngModel)]="filterStatus">
            <option value="">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </section>

      <section class="trainings-grid">
        <article class="training-card" *ngFor="let t of filteredTrainings" [ngClass]="t.status">
          <div class="card-header">
            <h3>{{ t.title }}</h3>
            <span class="status-badge" [ngClass]="t.status">{{ t.status }}</span>
          </div>
          <p class="card-desc">{{ t.description }}</p>
          <div class="card-meta">
            <div><strong>Date:</strong> {{ t.date | date:'medium' }}</div>
            <div><strong>Location:</strong> {{ t.location }}</div>
            <div><strong>Trainer:</strong> {{ t.trainer }}</div>
            <div><strong>Seats:</strong> {{ t.enrolled }}/{{ t.capacity }} enrolled</div>
          </div>
          <div class="card-actions">
            <button class="btn-cancel-training" *ngIf="t.status === 'upcoming'" (click)="cancelTraining(t)">Cancel</button>
            <button class="btn-complete" *ngIf="t.status === 'upcoming' || t.status === 'in-progress'" (click)="completeTraining(t)">Mark Complete</button>
          </div>
        </article>
        <div class="empty" *ngIf="filteredTrainings.length === 0">No training sessions found.</div>
      </section>
    </div>
  `,
  styles: [`
    .trainings-page {
      padding: var(--spacing-lg);
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      gap: var(--spacing-lg);
      background: #f8f9fa;
      min-height: 100vh;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-md);
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-lg);
    }

    .page-header h1 {
      margin: 0 0 4px;
      color: var(--color-text-dark);
      font-size: var(--font-size-2xl);
    }

    .page-header p {
      margin: 0;
      color: #7a7a7a;
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .btn-add {
      padding: 10px 14px;
      border: none;
      border-radius: 10px;
      background: var(--color-red);
      color: #fff;
      cursor: pointer;
      font-weight: 700;
    }

    .btn-add:hover { background: #b01030; }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--spacing-md);
    }

    .stat-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-md) var(--spacing-lg);
      display: grid;
      gap: 3px;
    }

    .stat-card span {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      color: #7a7a7a;
      letter-spacing: 0.04em;
      font-weight: 700;
    }

    .stat-card strong {
      font-size: var(--font-size-2xl);
      line-height: 1.1;
      color: var(--color-text-dark);
    }

    .stat-card.upcoming strong { color: #1d4ed8; }
    .stat-card.in-progress strong { color: #b45309; }
    .stat-card.completed strong { color: #2e7d32; }

    .create-section,
    .toolbar {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-lg);
    }

    .create-section h2 {
      margin: 0 0 var(--spacing-md);
      font-size: var(--font-size-lg);
      color: var(--color-text-dark);
    }

    .training-form {
      display: grid;
      gap: var(--spacing-md);
    }

    .training-form label {
      display: grid;
      gap: 6px;
      font-weight: 600;
      color: #4b5563;
      font-size: var(--font-size-sm);
    }

    .training-form input,
    .training-form textarea,
    .training-form select,
    .toolbar select {
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: var(--font-size-sm);
      background: #fff;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--spacing-md);
    }

    .form-actions {
      display: flex;
      gap: var(--spacing-sm);
      justify-content: flex-end;
    }

    .btn-create,
    .btn-cancel {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-create { background: #2e7d32; color: #fff; }
    .btn-create:hover { background: #1f6c27; }
    .btn-cancel { background: #6b7280; color: #fff; }
    .btn-cancel:hover { background: #4b5563; }

    .toolbar label {
      display: inline-grid;
      gap: 6px;
      color: #4b5563;
      font-size: var(--font-size-sm);
      font-weight: 600;
    }

    .trainings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--spacing-md);
    }

    .training-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-md);
      padding: var(--spacing-md);
      box-shadow: var(--shadow-sm);
      display: grid;
      gap: var(--spacing-sm);
      border-left: 4px solid #d1d5db;
    }

    .training-card.upcoming { border-left-color: #3b82f6; }
    .training-card.in-progress { border-left-color: #f59e0b; }
    .training-card.completed { border-left-color: #22c55e; }
    .training-card.cancelled { border-left-color: #ef4444; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-sm);
    }

    .card-header h3 {
      margin: 0;
      color: #111827;
      font-size: var(--font-size-base);
    }

    .card-desc {
      margin: 0;
      color: #4b5563;
      font-size: var(--font-size-sm);
      line-height: 1.45;
    }

    .card-meta {
      display: grid;
      gap: 4px;
      font-size: var(--font-size-sm);
      color: #374151;
    }

    .status-badge {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
      letter-spacing: 0.04em;
    }

    .status-badge.upcoming { background: #dbeafe; color: #1d4ed8; }
    .status-badge.in-progress { background: #fef3c7; color: #b45309; }
    .status-badge.completed { background: #dcfce7; color: #166534; }
    .status-badge.cancelled { background: #fee2e2; color: #991b1b; }

    .card-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .card-actions button {
      border: none;
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }

    .btn-cancel-training { background: #ef4444; color: #fff; }
    .btn-cancel-training:hover { background: #dc2626; }
    .btn-complete { background: #22c55e; color: #fff; }
    .btn-complete:hover { background: #16a34a; }

    .empty {
      text-align: center;
      padding: var(--spacing-xl);
      color: #9ca3af;
      grid-column: 1 / -1;
      background: var(--color-white);
      border: 1px dashed #d1d5db;
      border-radius: var(--border-radius-md);
    }

    @media (max-width: 768px) {
      .trainings-page {
        padding: var(--spacing-md);
      }

      .page-header {
        flex-direction: column;
      }

      .btn-add {
        width: 100%;
      }
    }
  `]
})
export class TrainingsComponent implements OnInit {
  trainings: Training[] = [];
  filterStatus = '';
  showCreateForm = false;

  newTraining: Partial<Training> = {
    title: '',
    description: '',
    date: '',
    location: '',
    trainer: '',
    capacity: 20
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTrainings();
  }

  loadTrainings(): void {
    // TODO: Replace with real API call when backend endpoint is ready
    // this.http.get<Training[]>('/api/trainings').subscribe(t => this.trainings = t);

    // Sample data for now
    this.trainings = [
      { id: '1', title: 'First Aid & CPR', description: 'Certified first aid and CPR training for all riders.', date: new Date(Date.now() + 604800000).toISOString(), location: 'HQ Training Room', trainer: 'Dr. O\'Sullivan', capacity: 20, enrolled: 12, status: 'upcoming' },
      { id: '2', title: 'Advanced Riding Skills', description: 'Advanced motorcycle handling and defensive riding techniques.', date: new Date(Date.now() + 1209600000).toISOString(), location: 'Galway Circuit', trainer: 'Mike Dunlop', capacity: 15, enrolled: 15, status: 'upcoming' },
      { id: '3', title: 'Blood Sample Handling', description: 'Proper handling, storage, and transport of blood samples.', date: new Date(Date.now() - 604800000).toISOString(), location: 'University Hospital', trainer: 'Nurse Kelly', capacity: 25, enrolled: 18, status: 'completed' },
    ];
  }

  get filteredTrainings(): Training[] {
    return this.trainings.filter(t => {
      return !this.filterStatus || t.status === this.filterStatus;
    });
  }

  get upcomingCount(): number {
    return this.trainings.filter((t) => t.status === 'upcoming').length;
  }

  get inProgressCount(): number {
    return this.trainings.filter((t) => t.status === 'in-progress').length;
  }

  get completedCount(): number {
    return this.trainings.filter((t) => t.status === 'completed').length;
  }

  createTraining(): void {
    const training: Training = {
      id: Date.now().toString(),
      title: this.newTraining.title || '',
      description: this.newTraining.description || '',
      date: this.newTraining.date || new Date().toISOString(),
      location: this.newTraining.location || '',
      trainer: this.newTraining.trainer || '',
      capacity: this.newTraining.capacity || 20,
      enrolled: 0,
      status: 'upcoming'
    };
    this.trainings.unshift(training);
    this.newTraining = { title: '', description: '', date: '', location: '', trainer: '', capacity: 20 };
    this.showCreateForm = false;
    // TODO: Persist via API
    // this.http.post('/api/trainings', training).subscribe();
  }

  cancelTraining(t: Training): void {
    t.status = 'cancelled';
  }

  completeTraining(t: Training): void {
    t.status = 'completed';
  }
}
