import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { Event, CreateEventDto } from '../models/event.model';
import { NotificationService } from './notification.service';

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
  private notifications = inject(NotificationService);

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

  createEvent(eventDto: CreateEventDto): Observable<boolean> {
    return this.http
      .post<ApiEvent>('/api/events', eventDto)
      .pipe(
        map((e) => this.fromApiEvent(e)),
        tap((created) => {
          this.events.update((events) => [...events, created]);
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to create event', err);
          this.notifications.error('Could not create the event. Please try again.', 'events:create');
          return of(false);
        })
      );
  }

  updateEvent(id: string, updates: Partial<Event>): Observable<boolean> {
    // backend expects PATCH-like semantics
    return this.http
      .patch<ApiEvent>(`/api/events/${id}`, updates)
      .pipe(
        map((e) => this.fromApiEvent(e)),
        tap((updated) => {
          this.events.update((events) =>
            events.map((event) => (event.id === id ? updated : event))
          );
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to update event', err);
          this.notifications.error('Could not update the event.', 'events:update');
          return of(false);
        })
      );
  }

  deleteEvent(id: string): Observable<boolean> {
    return this.http
      .delete(`/api/events/${id}`)
      .pipe(
        tap(() => {
          this.events.update((events) => events.filter((event) => event.id !== id));
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to delete event', err);
          this.notifications.error('Could not delete the event.', 'events:delete');
          return of(false);
        })
      );
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
          this.notifications.warning('Event data could not be refreshed.', 'events:load');
          return of(null);
        })
      )
      .subscribe((events) => {
        if (!events) return;
        this.events.set(events);
      });
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
