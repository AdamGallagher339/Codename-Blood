import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { Event, CreateEventDto } from '../models/event.model';

type ApiEvent = Omit<Event, 'date' | 'createdAt' | 'updatedAt'> & {
  date: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private events = signal<Event[]>([]);
  private loaded = false;
  
  constructor(private http: HttpClient) {}

  getEvents() {
    if (!this.loaded) {
      this.loaded = true;
      this.loadEvents();
    }
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

  createEvent(eventDto: CreateEventDto): void {
    this.http
      .post<ApiEvent>('/api/events', eventDto)
      .pipe(
        map((e) => this.fromApiEvent(e)),
        catchError((err) => {
          console.error('Failed to create event', err);
          return of(null);
        })
      )
      .subscribe((created) => {
        if (!created) return;
        this.events.update((events) => [...events, created]);
      });
  }

  updateEvent(id: string, updates: Partial<Event>): void {
    // backend expects PATCH-like semantics
    this.http
      .patch<ApiEvent>(`/api/events/${id}`, updates)
      .pipe(
        map((e) => this.fromApiEvent(e)),
        catchError((err) => {
          console.error('Failed to update event', err);
          return of(null);
        })
      )
      .subscribe((updated) => {
        if (!updated) return;
        this.events.update((events) =>
          events.map((event) => (event.id === id ? updated : event))
        );
      });
  }

  deleteEvent(id: string): void {
    this.http
      .delete(`/api/events/${id}`)
      .pipe(
        catchError((err) => {
          console.error('Failed to delete event', err);
          return of(null);
        })
      )
      .subscribe(() => {
        this.events.update((events) => events.filter((event) => event.id !== id));
      });
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private loadEvents(): void {
    this.http
      .get<ApiEvent[]>('/api/events')
      .pipe(
        map((events) => events.map((e) => this.fromApiEvent(e))),
        catchError((err) => {
          console.error('Failed to load events', err);
          return of([] as Event[]);
        })
      )
      .subscribe((events) => this.events.set(events));
  }

  private fromApiEvent(e: ApiEvent): Event {
    return {
      ...e,
      date: new Date(e.date),
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt)
    };
  }
}
