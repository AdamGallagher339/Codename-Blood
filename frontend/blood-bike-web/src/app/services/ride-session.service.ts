import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { RideSession, CreateRideSessionDto, EndRideSessionDto } from '../models/ride-session.model';
import { NotificationService } from './notification.service';

type ApiRideSession = Omit<RideSession, 'startTime' | 'endTime'> & {
  startTime: string;
  endTime: string;
};

@Injectable({
  providedIn: 'root'
})
export class RideSessionService {
  private sessions = signal<RideSession[]>([]);
  private loaded = false;
  private notifications = inject(NotificationService);

  constructor(private http: HttpClient) {}

  getSessions() {
    if (!this.loaded) {
      this.loaded = true;
      this.loadSessions();
    }
    return this.sessions.asReadonly();
  }

  getSessionsByBike(bikeId: string): Observable<RideSession[]> {
    return this.http
      .get<ApiRideSession[]>(`/api/ride-sessions?bikeId=${encodeURIComponent(bikeId)}`)
      .pipe(
        map((items) => items.map((s) => this.fromApi(s))),
        catchError((err) => {
          console.error('Failed to load ride sessions for bike', err);
          this.notifications.warning('Could not load ride sessions.', 'ride-sessions:load-bike');
          return of([]);
        })
      );
  }

  createSession(dto: CreateRideSessionDto): Observable<boolean> {
    return this.http
      .post<ApiRideSession>('/api/ride-sessions', dto)
      .pipe(
        map((s) => this.fromApi(s)),
        tap((created) => {
          this.sessions.update((list) => [...list, created]);
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to create ride session', err);
          this.notifications.error('Could not start the ride session.', 'ride-sessions:create');
          return of(false);
        })
      );
  }

  endSession(sessionId: string, dto: EndRideSessionDto): Observable<boolean> {
    return this.http
      .put<ApiRideSession>(`/api/ride-sessions/${sessionId}`, dto)
      .pipe(
        map((s) => this.fromApi(s)),
        tap((updated) => {
          this.sessions.update((list) =>
            list.map((s) => (s.sessionId === sessionId ? updated : s))
          );
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to end ride session', err);
          this.notifications.error('Could not end the ride session.', 'ride-sessions:end');
          return of(false);
        })
      );
  }

  deleteSession(sessionId: string): Observable<boolean> {
    return this.http
      .delete(`/api/ride-sessions/${sessionId}`)
      .pipe(
        tap(() => {
          this.sessions.update((list) => list.filter((s) => s.sessionId !== sessionId));
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to delete ride session', err);
          this.notifications.error('Could not delete the ride session.', 'ride-sessions:delete');
          return of(false);
        })
      );
  }

  private loadSessions(): void {
    this.http
      .get<ApiRideSession[]>('/api/ride-sessions')
      .pipe(
        map((items) => items.map((s) => this.fromApi(s))),
        catchError((err) => {
          console.error('Failed to load ride sessions', err);
          this.notifications.warning('Ride session data could not be refreshed.', 'ride-sessions:load');
          return of(null);
        })
      )
      .subscribe((sessions) => {
        if (!sessions) return;
        this.sessions.set(sessions);
      });
  }

  private fromApi(s: ApiRideSession): RideSession {
    return {
      ...s,
      startTime: new Date(s.startTime),
      endTime: s.endTime ? new Date(s.endTime) : new Date(0),
    };
  }
}
