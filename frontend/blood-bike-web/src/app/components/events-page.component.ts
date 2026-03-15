import { Component, signal, computed, viewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarComponent } from './calendar.component';
import { EventFormComponent } from './event-form.component';
import { DashboardPageHeaderComponent, PageStat } from './dashboard-page-header.component';
import { SectionCardComponent } from './section-card.component';
import { SummaryStatCardComponent } from './summary-stat-card.component';
import { EmptyStateComponent } from './empty-state.component';
import { EventService } from '../services/event.service';
import { Event, CreateEventDto } from '../models/event.model';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [
    CommonModule,
    CalendarComponent,
    EventFormComponent,
    DashboardPageHeaderComponent,
    SectionCardComponent,
    SummaryStatCardComponent,
    EmptyStateComponent
  ],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss'
})
export class EventsPageComponent {
  private eventService = inject(EventService);
  
  eventForm = viewChild.required(EventFormComponent);
  
  selectedDate = signal<Date | null>(null);
  viewMode = signal<'calendar' | 'list'>('calendar');
  
  events = this.eventService.getEvents();
  
  // Computed stats for header
  totalEvents = computed(() => this.events().length);

  todayEvents = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.events().filter(e => {
      const eventDate = new Date(e.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime();
    }).length;
  });

  upcomingCount = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.events().filter(e => new Date(e.date) >= today).length;
  });

  headerStats = computed((): PageStat[] => [
    {
      icon: '📅',
      label: 'Total Events',
      value: this.totalEvents(),
      color: 'blue'
    },
    {
      icon: '🔔',
      label: "Today's Events",
      value: this.todayEvents(),
      color: 'yellow'
    },
    {
      icon: '⏭️',
      label: 'Upcoming Events',
      value: this.upcomingCount(),
      color: 'green'
    }
  ]);
  
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

  /** Top 3 soonest upcoming events shown before the calendar/list view */
  soonestEvents = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.events()
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  });

  daysUntil(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  }
  
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
