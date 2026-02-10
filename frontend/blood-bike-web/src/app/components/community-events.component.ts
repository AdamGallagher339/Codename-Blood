import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-community-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1>Community Events</h1>
      <p>Create and view community events with your role displayed.</p>
      
      <section class="section">
        <h2>Create an Event</h2>
        <form (ngSubmit)="createEvent()">
          <div>
            <label>Event Title:</label>
            <input type="text" [(ngModel)]="newEvent.title" name="title" placeholder="Enter event title" />
          </div>
          <div>
            <label>Description:</label>
            <textarea [(ngModel)]="newEvent.description" name="description" placeholder="Event description"></textarea>
          </div>
          <div>
            <label>Date & Time:</label>
            <input type="datetime-local" [(ngModel)]="newEvent.dateTime" name="dateTime" />
          </div>
          <div>
            <label>Location:</label>
            <input type="text" [(ngModel)]="newEvent.location" name="location" placeholder="Event location" />
          </div>
          <button type="submit">Create Event</button>
        </form>
      </section>

      <section class="section">
        <h2>All Events</h2>
        <div *ngIf="events.length === 0" class="no-events">
          No community events yet. Be the first to create one!
        </div>
        <div *ngFor="let event of events" class="event-card">
          <div class="event-header">
            <h3>{{ event.title }}</h3>
            <span class="event-role">Role: {{ event.creatorRole }}</span>
          </div>
          <p>{{ event.description }}</p>
          <div class="event-meta">
            <span><strong>Date:</strong> {{ event.dateTime }}</span>
            <span><strong>Location:</strong> {{ event.location }}</span>
            <span><strong>By:</strong> {{ event.createdBy }}</span>
          </div>
          <div class="event-actions">
            <button *ngIf="canDeleteEvent(event)" (click)="deleteEvent(event.id)" class="delete-btn">Delete</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 20px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    form div {
      margin: 10px 0;
    }
    label {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
    }
    input, textarea {
      width: 100%;
      padding: 8px;
      box-sizing: border-box;
      font-family: inherit;
    }
    button {
      padding: 8px 16px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background-color: #0056b3;
    }
    button.delete-btn {
      background-color: #dc3545;
    }
    button.delete-btn:hover {
      background-color: #c82333;
    }
    .no-events {
      padding: 20px;
      text-align: center;
      color: #999;
    }
    .event-card {
      margin: 15px 0;
      padding: 15px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background-color: #f9f9f9;
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .event-header h3 {
      margin: 0;
    }
    .event-role {
      background-color: #e7f3ff;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 0.9em;
      font-weight: bold;
    }
    .event-meta {
      display: flex;
      gap: 20px;
      margin: 10px 0;
      font-size: 0.9em;
      color: #666;
    }
    .event-actions {
      margin-top: 10px;
    }
  `]
})
export class CommunityEventsComponent implements OnInit {
  newEvent = {
    title: '',
    description: '',
    dateTime: '',
    location: ''
  };
  
  events: any[] = [];
  currentUsername = '';
  currentRole = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.currentRole = localStorage.getItem('bb_selected_role') || '';
    this.loadEvents();
  }

  createEvent() {
    if (!this.newEvent.title || !this.newEvent.description) {
      alert('Please fill in all fields');
      return;
    }

    const event = {
      ...this.newEvent,
      createdBy: this.currentUsername,
      creatorRole: this.currentRole,
      createdAt: new Date().toISOString()
    };

    this.events.unshift(event);
    this.newEvent = { title: '', description: '', dateTime: '', location: '' };
  }

  loadEvents() {
    // TODO: Load from backend /api/events
  }

  canDeleteEvent(event: any): boolean {
    return this.currentUsername === event.createdBy || this.currentRole === 'BloodBikeAdmin';
  }

  deleteEvent(eventId: string) {
    if (confirm('Are you sure you want to delete this event?')) {
      this.events = this.events.filter(e => e.id !== eventId);
    }
  }
}
