import { Component, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarComponent } from './calendar.component';
import { EventFormComponent } from './event-form.component';
import { EventService } from '../services/event.service';
import { Event, CreateEventDto } from '../models/event.model';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, CalendarComponent, EventFormComponent],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss'
})
export class EventsPageComponent {
  eventForm = viewChild.required(EventFormComponent);
  
  selectedDate = signal<Date | null>(null);
  viewMode = signal<'calendar' | 'list'>('calendar');
  
  events = this.eventService.getEvents();
  
  selectedDateEvents = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.eventService.getEventsByDate(date);
  });
  
  upcomingEvents = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.events()
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  });
  
  constructor(private eventService: EventService) {}
  
  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
  }
  
  openCreateEventModal(): void {
    this.eventForm().open();
  }
  
  createEvent(eventDto: CreateEventDto): void {
    this.eventService.createEvent(eventDto);
  }
  
  deleteEvent(eventId: string): void {
    if (confirm('Are you sure you want to delete this event?')) {
      this.eventService.deleteEvent(eventId);
    }
  }
  
  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'calendar' ? 'list' : 'calendar');
  }
  
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
  
  getEventTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      delivery: '🚴',
      training: '📚',
      maintenance: '🔧',
      meeting: '👥',
      emergency: '🚨',
      other: '📋'
    };
    return icons[type] || '📋';
  }
  
  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }
}
