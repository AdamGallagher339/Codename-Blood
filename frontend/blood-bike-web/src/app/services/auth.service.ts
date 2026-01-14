import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { catchError, map, of, tap, throwError } from 'rxjs';

export type AuthPage = 'welcome' | 'login' | 'signup' | 'confirm' | 'home';

export interface MeResponse {
  sub: string;
  username?: string;
  email?: string;
  roles: string[];
}

interface SignUpRequest {
  username: string;
  password: string;
  email: string;
}

interface ConfirmRequest {
  username: string;
  code: string;
}

interface SignInRequest {
  username: string;
  password: string;
}

interface SignInResponse {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
}

const ACCESS_TOKEN_KEY = 'bb_access_token';
const ID_TOKEN_KEY = 'bb_id_token';
const REFRESH_TOKEN_KEY = 'bb_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<MeResponse | null>(null);
  readonly roles = computed(() => this.user()?.roles ?? []);
  readonly isLoggedIn = computed(() => !!(this.getIdToken() || this.getAccessToken()));

  readonly lastAuthError = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getIdToken(): string | null {
    return localStorage.getItem(ID_TOKEN_KEY);
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.user.set(null);
    this.lastAuthError.set(null);
  }

  hasRole(role: string): boolean {
    return (this.user()?.roles ?? []).includes(role);
  }

  signUp(req: SignUpRequest) {
    this.lastAuthError.set(null);
    return this.http.post('/api/auth/signup', req).pipe(
      map(() => true),
      catchError((err) => this.handleAuthError(err))
    );
  }

  confirmSignUp(req: ConfirmRequest) {
    this.lastAuthError.set(null);
    return this.http.post('/api/auth/confirm', req).pipe(
      map(() => true),
      catchError((err) => this.handleAuthError(err))
    );
  }

  signIn(req: SignInRequest) {
    this.lastAuthError.set(null);
    return this.http.post<SignInResponse>('/api/auth/signin', req).pipe(
      tap((tokens) => {
        if (tokens.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
        if (tokens.idToken) localStorage.setItem(ID_TOKEN_KEY, tokens.idToken);
        if (tokens.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      }),
      map(() => true),
      catchError((err) => this.handleAuthError(err))
    );
  }

  fetchMe() {
    this.lastAuthError.set(null);
    if (!this.getIdToken() && !this.getAccessToken()) {
      this.user.set(null);
      return of(null);
    }

    return this.http.get<MeResponse>('/api/me').pipe(
      tap((me) => this.user.set(me)),
      catchError((err) => {
        // If token is invalid/expired, clear it out.
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.logout();
          return of(null);
        }
        return this.handleAuthError(err);
      })
    );
  }

  private handleAuthError(err: unknown) {
    const message = this.toMessage(err);
    this.lastAuthError.set(message);
    return throwError(() => err);
  }

  private toMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const backend = typeof err.error === 'string' ? err.error : (err.error?.message as string | undefined);
      return backend || err.message;
    }
    if (err instanceof Error) return err.message;
    return 'Unknown error';
  }
}
