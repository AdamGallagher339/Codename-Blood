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
    <div class="page-container">
      <h1>🎓 Trainings</h1>
      <p>Schedule and manage volunteer training sessions.</p>

      <!-- Create Training -->
      <div class="create-section" *ngIf="showCreateForm">
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
              <span>Date & Time</span>
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
      </div>

      <button *ngIf="!showCreateForm" class="btn-add" (click)="showCreateForm = true">+ Schedule Training</button>

      <!-- Filters -->
      <div class="filters">
        <label>
          Status:
          <select [(ngModel)]="filterStatus">
            <option value="">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <!-- Trainings List -->
      <div class="trainings-grid">
        <div class="training-card" *ngFor="let t of filteredTrainings">
          <div class="card-header">
            <h3>{{ t.title }}</h3>
            <span class="status-badge" [ngClass]="t.status">{{ t.status }}</span>
          </div>
          <p class="card-desc">{{ t.description }}</p>
          <div class="card-meta">
            <div><strong>📅</strong> {{ t.date | date:'medium' }}</div>
            <div><strong>📍</strong> {{ t.location }}</div>
            <div><strong>👤</strong> {{ t.trainer }}</div>
            <div><strong>👥</strong> {{ t.enrolled }}/{{ t.capacity }} enrolled</div>
          </div>
          <div class="card-actions">
            <button class="btn-cancel-training" *ngIf="t.status === 'upcoming'" (click)="cancelTraining(t)">Cancel</button>
            <button class="btn-complete" *ngIf="t.status === 'upcoming' || t.status === 'in-progress'" (click)="completeTraining(t)">Mark Complete</button>
          </div>
        </div>
        <div class="empty" *ngIf="filteredTrainings.length === 0">No training sessions found.</div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 1rem; max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 0.25rem; }
    p { color: #666; margin-bottom: 1rem; }

    .btn-add {
      padding: 0.5rem 1rem; background: #dc143c; color: #fff; border: none; border-radius: 8px;
      cursor: pointer; font-weight: 600; margin-bottom: 1rem;
      &:hover { background: #b01030; }
    }

    .create-section {
      background: #f9f9f9; padding: 1rem; border-radius: 10px; margin-bottom: 1rem; border: 1px solid #eee;
      h2 { margin-top: 0; margin-bottom: 0.75rem; }
    }
    .training-form {
      display: flex; flex-direction: column; gap: 0.75rem;
      label { display: flex; flex-direction: column; gap: 0.25rem; font-weight: 500; }
      input, textarea, select { padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; font-size: 0.95rem; }
    }
    .form-row { display: flex; gap: 1rem; flex-wrap: wrap; label { flex: 1; min-width: 200px; } }
    .form-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .btn-create {
      padding: 0.5rem 1.2rem; background: #28a745; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
      &:hover { background: #218838; }
    }
    .btn-cancel {
      padding: 0.5rem 1.2rem; background: #6c757d; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
      &:hover { background: #5a6268; }
    }

    .filters {
      display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;
      label { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
      select { padding: 0.4rem 0.6rem; border: 1px solid #ccc; border-radius: 6px; }
    }

    .trainings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
    .training-card {
      background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .card-header h3 { margin: 0; font-size: 1.1rem; }
    .card-desc { color: #555; font-size: 0.9rem; margin-bottom: 0.75rem; }
    .card-meta { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; margin-bottom: 0.75rem; }

    .status-badge {
      padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; white-space: nowrap;
      &.upcoming { background: #cce5ff; color: #004085; }
      &.in-progress { background: #fff3cd; color: #856404; }
      &.completed { background: #d4edda; color: #155724; }
      &.cancelled { background: #f8d7da; color: #721c24; }
    }

    .card-actions { display: flex; gap: 0.4rem; }
    .card-actions button {
      padding: 0.35rem 0.7rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;
    }
    .btn-cancel-training { background: #dc3545; color: #fff; &:hover { background: #c82333; } }
    .btn-complete { background: #28a745; color: #fff; &:hover { background: #218838; } }

    .empty { text-align: center; padding: 2rem; color: #999; grid-column: 1 / -1; }
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
