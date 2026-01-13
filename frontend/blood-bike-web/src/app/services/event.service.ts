import { Injectable, signal } from '@angular/core';
import { Event, CreateEventDto, EventStatus } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private events = signal<Event[]>([]);
  
  constructor() {
    this.loadMockEvents();
  }

  getEvents() {
    return this.events.asReadonly();
  }

  getEventsByDate(date: Date): Event[] {
    return this.events().filter(event => 
      this.isSameDay(new Date(event.date), date)
    );
  }

  getEventsByMonth(year: number, month: number): Event[] {
    return this.events().filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  }

  createEvent(eventDto: CreateEventDto): Event {
    const newEvent: Event = {
      ...eventDto,
      id: this.generateId(),
      status: EventStatus.SCHEDULED,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.events.update(events => [...events, newEvent]);
    return newEvent;
  }

  updateEvent(id: string, updates: Partial<Event>): void {
    this.events.update(events => 
      events.map(event => 
        event.id === id 
          ? { ...event, ...updates, updatedAt: new Date() }
          : event
      )
    );
  }

  deleteEvent(id: string): void {
    this.events.update(events => events.filter(event => event.id !== id));
  }

  private generateId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private loadMockEvents(): void {
    const today = new Date();
    const mockEvents: Event[] = [
      {
        id: '1',
        title: 'Blood Delivery to City Hospital',
        description: 'Urgent O-negative blood delivery',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        startTime: '09:00',
        endTime: '10:00',
        location: 'City Hospital, Ward 3',
        type: 'delivery' as any,
        priority: 'urgent' as any,
        assignedRiders: ['Rider #42'],
        status: EventStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        title: 'Weekly Team Meeting',
        description: 'Coordination meeting for all riders',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
        startTime: '14:00',
        endTime: '15:00',
        location: 'Main Office',
        type: 'meeting' as any,
        priority: 'medium' as any,
        status: EventStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        title: 'Bike Maintenance',
        description: 'Scheduled maintenance for bike fleet',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
        startTime: '10:00',
        endTime: '12:00',
        location: 'Garage',
        type: 'maintenance' as any,
        priority: 'high' as any,
        status: EventStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.events.set(mockEvents);
  }
}
