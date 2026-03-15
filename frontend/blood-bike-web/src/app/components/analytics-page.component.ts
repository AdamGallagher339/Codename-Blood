import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { AnalyticsService, RiderSummary, SpeedPoint, RiderOption } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';

interface ChartPoint { x: number; y: number }

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="analytics-page">
      <div class="analytics-header">
        <h1>📊 Analytics</h1>
        <span class="refresh-badge" *ngIf="lastRefresh()">Updated {{ lastRefresh() | date:'HH:mm:ss' }}</span>
      </div>

      <!-- Rider selector (fleet managers / dispatchers) -->
      <div class="rider-selector" *ngIf="canViewAll()">
        <label for="rider-select">Rider:</label>
        <select id="rider-select" [(ngModel)]="selectedRider" (ngModelChange)="onRiderChange()">
          <option value="">— Select a rider —</option>
          <option *ngFor="let r of riders()" [value]="r.id">{{ r.name }}</option>
        </select>
        <span class="hint" *ngIf="riders().length === 0">No riders found</span>
      </div>

      <!-- No data message -->
      <div class="no-data" *ngIf="!selectedRider && canViewAll()">
        Select a rider above to view their analytics.
      </div>

      <!-- Loading indicator -->
      <div class="loading" *ngIf="loading() && selectedRider">Loading analytics…</div>

      <!-- Error -->
      <div class="error" *ngIf="error()">⚠️ {{ error() }}</div>

      <!-- Metrics cards -->
      <div class="metrics-grid" *ngIf="summary() && selectedRider">
        <div class="metric-card highlight">
          <div class="metric-icon">⚡</div>
          <div class="metric-value">{{ summary()!.currentSpeedKph | number:'1.0-1' }}</div>
          <div class="metric-unit">km/h</div>
          <div class="metric-label">Current Speed</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">🏎️</div>
          <div class="metric-value">{{ summary()!.topSpeedKph | number:'1.0-1' }}</div>
          <div class="metric-unit">km/h</div>
          <div class="metric-label">Top Speed</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📈</div>
          <div class="metric-value">{{ summary()!.avgSpeedKph | number:'1.0-1' }}</div>
          <div class="metric-unit">km/h</div>
          <div class="metric-label">Avg Speed</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📍</div>
          <div class="metric-value">{{ summary()!.totalDistanceKm | number:'1.0-2' }}</div>
          <div class="metric-unit">km</div>
          <div class="metric-label">Distance</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">⏱️</div>
          <div class="metric-value">{{ summary()!.activeTimeMinutes | number:'1.0-0' }}</div>
          <div class="metric-unit">min</div>
          <div class="metric-label">Active Time</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📡</div>
          <div class="metric-value">{{ summary()!.dataPoints }}</div>
          <div class="metric-unit">pts</div>
          <div class="metric-label">GPS Points</div>
        </div>
      </div>

      <!-- Speed over time chart -->
      <div class="chart-card" *ngIf="summary() && selectedRider && speedHistory().length > 1">
        <h2>Speed Over Time</h2>
        <div class="chart-container">
          <svg [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH" preserveAspectRatio="none" class="chart-svg">
            <defs>
              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#dc3545" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#dc3545" stop-opacity="0.03"/>
              </linearGradient>
            </defs>
            <!-- Y-axis grid lines & labels -->
            <g *ngFor="let tick of yTicks()">
              <line [attr.x1]="labelW" [attr.y1]="tick.y" [attr.x2]="chartW - padR" [attr.y2]="tick.y"
                    stroke="#eee" stroke-width="1"/>
              <text [attr.x]="labelW - 4" [attr.y]="tick.y + 4" text-anchor="end"
                    font-size="10" fill="#999">{{ tick.label }}</text>
            </g>
            <!-- Area fill -->
            <polygon [attr.points]="areaPoints()" fill="url(#speedGrad)"/>
            <!-- Speed line -->
            <polyline [attr.points]="linePoints()" fill="none" stroke="#dc3545" stroke-width="2"
                      stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          <div class="chart-x-labels">
            <span>{{ speedHistory()[0]?.timestamp | date:'HH:mm' }}</span>
            <span>{{ speedHistory()[speedHistory().length - 1]?.timestamp | date:'HH:mm' }}</span>
          </div>
        </div>
        <div class="chart-legend">km/h over session time</div>
      </div>

      <!-- No history message -->
      <div class="empty-chart" *ngIf="summary() && selectedRider && speedHistory().length <= 1">
        <p>Not enough movement data yet to render a chart.</p>
        <p class="hint">Data appears once the rider starts moving.</p>
      </div>

      <!-- Last known position -->
      <div class="last-position" *ngIf="summary() && selectedRider && summary()!.lastLat !== 0">
        <small>📌 Last position: {{ summary()!.lastLat | number:'1.4-4' }},
          {{ summary()!.lastLng | number:'1.4-4' }}
          &nbsp;·&nbsp; {{ summary()!.lastSeen | date:'HH:mm:ss' }}</small>
      </div>
    </div>
  `,
  styles: [`
    /* ─────────────────────────────────────────────── Page Container ─────────────────────────────────────────────── */
    .analytics-page {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-height: 100vh;
      background: #f8f9fa;
      padding-top: var(--safe-top, 0px);
      padding-bottom: var(--safe-bottom, 0px);
    }

    /* ─────────────────────────────────────────────── Header ─────────────────────────────────────────────── */
    .analytics-header {
      background: var(--color-white);
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      padding: var(--spacing-lg);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--spacing-md);
      flex-shrink: 0;
    }

    h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-text-dark);
      margin: 0;
      line-height: 1.2;
    }

    .refresh-badge {
      font-size: var(--font-size-xs);
      color: #888;
      background: #f0f0f0;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      white-space: nowrap;
    }

    /* ─────────────────────────────────────────────── Content Area ─────────────────────────────────────────────── */
    .analytics-page > * {
      flex-shrink: 0;
    }

    .analytics-page > :not(.analytics-header) {
      margin: var(--spacing-lg);
    }

    /* ─────────────────────────────────────────────── Rider Selector ─────────────────────────────────────────────── */
    .rider-selector {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      background: var(--color-white);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid #e5e7eb;
      flex-wrap: wrap;
    }

    .rider-selector label {
      font-weight: 600;
      font-size: var(--font-size-sm);
      color: var(--color-text-dark);
      flex-shrink: 0;
    }

    .rider-selector select {
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--border-radius-md);
      border: 1px solid #d0dce8;
      background: var(--color-white);
      color: var(--color-text-dark);
      font-size: var(--font-size-sm);
      font-weight: 500;
      min-width: 200px;
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        border-color: #b8cfe0;
      }

      &:focus {
        outline: none;
        border-color: var(--color-red);
        box-shadow: 0 0 0 3px rgba(220, 20, 60, 0.1);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .hint {
      font-size: var(--font-size-xs);
      color: #888;
      font-weight: 500;
    }

    /* ─────────────────────────────────────────────── State Messages ─────────────────────────────────────────────── */
    .no-data,
    .loading,
    .error {
      padding: var(--spacing-2xl) var(--spacing-lg);
      border-radius: var(--border-radius-lg);
      text-align: center;
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      color: #888;
      font-weight: 500;
      margin: 0;
    }

    .error {
      background: #fee2e2;
      border-color: #fca5a5;
      color: #7f1d1d;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-md);
      min-height: 100px;
    }

    .loading::after {
      content: '';
      width: 24px;
      height: 24px;
      border: 3px solid #e5e7eb;
      border-top-color: var(--color-red);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ─────────────────────────────────────────────── Metrics Grid ─────────────────────────────────────────────── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--spacing-lg);
      margin: 0;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .metric-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      text-align: center;
      box-shadow: var(--shadow-sm);
      transition: all var(--transition-fast);

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
      }

      &.highlight {
        border-color: var(--color-red);
        background: linear-gradient(135deg, #fff5f6 0%, var(--color-white) 100%);

        .metric-icon {
          color: var(--color-red);
        }
      }
    }

    .metric-icon {
      font-size: var(--font-size-2xl);
      display: block;
      margin-bottom: var(--spacing-sm);
    }

    .metric-value {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      line-height: 1;
      color: var(--color-text-dark);
      margin-bottom: var(--spacing-xs);
    }

    .metric-unit {
      font-size: var(--font-size-xs);
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: var(--spacing-xs);
    }

    .metric-label {
      font-size: var(--font-size-xs);
      color: #666;
      font-weight: 500;
    }

    /* ─────────────────────────────────────────────── Chart Card ─────────────────────────────────────────────── */
    .chart-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      box-shadow: var(--shadow-sm);
      margin: 0;
      animation: fadeIn 0.3s ease-out 0.1s backwards;
    }

    .chart-card h2 {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-text-dark);
      margin: 0 0 var(--spacing-lg) 0;
    }

    .chart-container {
      position: relative;
      background: #fafafa;
      border-radius: var(--border-radius-md);
      padding: var(--spacing-md);
    }

    .chart-svg {
      width: 100%;
      height: 200px;
      display: block;
      overflow: visible;
    }

    .chart-x-labels {
      display: flex;
      justify-content: space-between;
      font-size: var(--font-size-xs);
      color: #888;
      padding: var(--spacing-sm) 0;
      font-weight: 500;
    }

    .chart-legend {
      text-align: center;
      font-size: var(--font-size-xs);
      color: #888;
      margin-top: var(--spacing-md);
      font-weight: 500;
    }

    /* ─────────────────────────────────────────────── Empty Chart State ─────────────────────────────────────────────── */
    .empty-chart {
      background: linear-gradient(135deg, #f8f9fa 0%, #f0f1f3 100%);
      border: 1px dashed #d0dce8;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-2xl) var(--spacing-lg);
      text-align: center;
      color: #888;
      margin: 0;
    }

    .empty-chart p {
      margin: var(--spacing-xs) 0;
      font-size: var(--font-size-sm);
      font-weight: 500;

      &.hint {
        font-size: var(--font-size-xs);
        color: #aaa;
      }
    }

    /* ─────────────────────────────────────────────── Last Position Info ─────────────────────────────────────────────── */
    .last-position {
      text-align: right;
      color: #888;
      font-size: var(--font-size-xs);
      font-weight: 500;
      margin: 0;
      padding: 0 var(--spacing-lg);
    }

    /* ─────────────────────────────────────────────── Advanced Animations ─────────────────────────────────────────────── */

    /* Staggered animation for metric cards */
    .metrics-grid .metric-card {
      @for $i from 0 through 6 {
        &:nth-child(#{$i}) {
          animation: slideUp 0.4s ease-out backwards;
          animation-delay: #{$i * 50}ms;
        }
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }

    /* Loading skeleton effect */
    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }

    /* Smooth hover interactions */
    .metric-card {
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom, rgba(255, 255, 255, 0.5), transparent);
        opacity: 0;
        transition: opacity var(--transition-fast);
        pointer-events: none;
        border-radius: var(--border-radius-lg);
      }

      &:hover::before {
        opacity: 1;
      }
    }

    /* Chart line animation */
    .chart-svg polyline {
      animation: drawLine 0.8s ease-out forwards;
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
    }

    @keyframes drawLine {
      to {
        stroke-dashoffset: 0;
      }
    }

    /* Focus states for better accessibility */
    button, select, input {
      &:focus-visible {
        outline: 2px solid var(--color-red);
        outline-offset: 2px;
        border-radius: var(--border-radius-md);
      }
    }

    /* Smooth transitions for metric values */
    .metric-value,
    .metric-unit,
    .metric-label {
      display: block;
    }

    /* Enhanced card depth on hover */
    .metric-card {
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      &:hover {
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }
    }

    .chart-card {
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    /* Text selection improvements */
    .metric-value,
    .metric-label,
    .refresh-badge {
      user-select: text;
      -webkit-user-select: text;
    }

    /* Color transitions for status indicators */
    .metric-card.highlight {
      border-color: var(--color-red);

      &:hover {
        border-color: #b01030;
      }
    }

    /* Ripple effect on tap (mobile) */
    @media (pointer: coarse) {
      .metric-card {
        &:active {
          transform: scale(0.98);
        }
      }
    }

    /* ──────────────────────────────────────────────────────────────────────────── */

    /* ─────────────────────────────────────────────── Enhanced Responsive Design ─────────────────────────────────────────────── */
    /* ─────────────────────────────────────────────── Enhanced Responsive Design ─────────────────────────────────────────────── */

    @media (max-width: 1024px) {
      .metrics-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .analytics-header {
        padding: var(--spacing-md);
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-sm);
      }

      h1 {
        font-size: var(--font-size-xl);
        margin-bottom: 0;
      }

      .refresh-badge {
        font-size: 10px;
      }

      .analytics-page > :not(.analytics-header) {
        margin: var(--spacing-md);
      }

      .rider-selector {
        width: calc(100% - var(--spacing-md) * 2);
        padding: var(--spacing-md);
        gap: var(--spacing-sm);

        select {
          flex: 1;
          min-width: 140px;
        }
      }

      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--spacing-md);
      }

      .metric-card {
        padding: var(--spacing-md);

        .metric-icon {
          font-size: var(--font-size-xl);
        }

        .metric-value {
          font-size: var(--font-size-xl);
        }

        .metric-unit {
          font-size: 11px;
        }

        .metric-label {
          font-size: 11px;
        }
      }

      .chart-card {
        padding: var(--spacing-md);

        h2 {
          font-size: var(--font-size-base);
          margin-bottom: var(--spacing-md);
        }
      }

      .chart-svg {
        height: 160px;
      }

      .chart-x-labels {
        font-size: 10px;
        padding: var(--spacing-xs) 0;
      }

      .chart-legend {
        font-size: 11px;
        margin-top: var(--spacing-sm);
      }

      .empty-chart {
        padding: var(--spacing-lg) var(--spacing-md);
      }

      .empty-chart p {
        font-size: 13px;
      }

      .last-position {
        padding: 0 var(--spacing-md);
        font-size: 11px;
      }

      .no-data,
      .loading,
      .error {
        padding: var(--spacing-lg) var(--spacing-md);
        font-size: 14px;
      }
    }

    @media (max-width: 480px) {
      .analytics-header {
        padding: var(--spacing-sm);
        gap: 0;
        margin-bottom: 0;
      }

      h1 {
        font-size: var(--font-size-lg);
        margin-bottom: var(--spacing-xs);
      }

      .refresh-badge {
        font-size: 9px;
        padding: 1px 3px;
        align-self: flex-start;
        margin-top: var(--spacing-xs);
      }

      .analytics-page > :not(.analytics-header) {
        margin: var(--spacing-sm);
      }

      .rider-selector {
        width: calc(100% - var(--spacing-sm) * 2);
        flex-direction: column;
        align-items: stretch;
        padding: var(--spacing-sm);
        gap: var(--spacing-xs);
        border-radius: var(--border-radius-md);
      }

      .rider-selector label {
        font-size: 12px;
      }

      .rider-selector select {
        width: 100%;
        font-size: 13px;
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-sm);
      }

      .metrics-grid {
        grid-template-columns: 1fr;
        gap: var(--spacing-sm);
      }

      .metric-card {
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-md);

        .metric-icon {
          font-size: var(--font-size-lg);
          margin-bottom: 4px;
        }

        .metric-value {
          font-size: var(--font-size-lg);
        }

        .metric-unit {
          font-size: 9px;
          margin-bottom: 2px;
        }

        .metric-label {
          font-size: 10px;
        }
      }

      .chart-card {
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-md);
      }

      .chart-card h2 {
        font-size: 13px;
        margin-bottom: var(--spacing-sm);
      }

      .chart-container {
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
      }

      .chart-svg {
        height: 120px;
      }

      .chart-x-labels {
        font-size: 9px;
        padding: 2px 0;
      }

      .chart-legend {
        font-size: 10px;
        margin-top: var(--spacing-xs);
      }

      .empty-chart {
        padding: var(--spacing-md) var(--spacing-sm);
        border-radius: var(--border-radius-md);
      }

      .empty-chart p {
        font-size: 12px;
        margin: 4px 0;

        &.hint {
          font-size: 10px;
        }
      }

      .last-position {
        padding: 0 var(--spacing-sm);
        font-size: 9px;
      }

      .no-data,
      .loading,
      .error {
        padding: var(--spacing-md) var(--spacing-sm);
        font-size: 13px;
        border-radius: var(--border-radius-md);
      }
    }

    /* ─────────────────────────────────────────────── Touch & Accessibility ─────────────────────────────────────────────── */

    @media (hover: none) and (pointer: coarse) {
      .metric-card {
        &:active {
          opacity: 0.9;
          transform: scale(0.98);
        }
      }

      select {
        font-size: 16px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media (prefers-color-scheme: dark) {
      .analytics-page {
        background: #1a1a1a;
      }

      .analytics-header,
      .rider-selector,
      .metric-card,
      .chart-card,
      .no-data,
      .loading,
      .error {
        background: #2a2a2a;
        border-color: #3a3a3a;
        color: #e0e0e0;
      }

      h1 {
        color: #fff;
      }

      .metric-value {
        color: #fff;
      }

      .refresh-badge {
        background: #1a1a1a;
        color: #bbb;
      }

      .chart-container {
        background: #1a1a1a;
      }

      .empty-chart {
        background: #1a1a1a;
        border-color: #3a3a3a;
        color: #bbb;
      }

      .chart-x-labels,
      .chart-legend,
      .last-position,
      .hint {
        color: #999;
      }

      input, select {
        background: #1a1a1a;
        color: #e0e0e0;
        border-color: #3a3a3a;

        &:focus {
          border-color: var(--color-red);
        }
      }
    }

    /* High contrast mode support */
    @media (prefers-contrast: more) {
      .metric-card {
        border-width: 2px;
      }

      button, select {
        font-weight: 700;
      }
    }
  `]
})
export class AnalyticsPageComponent implements OnInit, OnDestroy {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly auth = inject(AuthService);

  // Chart dimensions
  readonly chartW = 560;
  readonly chartH = 140;
  readonly padTop = 10;
  readonly padBot = 20;
  readonly padR = 10;
  readonly labelW = 32;

  // State
  readonly summary = signal<RiderSummary | null>(null);
  readonly riders = signal<RiderOption[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastRefresh = signal<Date | null>(null);

  selectedRider = '';
  private pollSub?: Subscription;

  readonly canViewAll = computed(() => {
    const roles = this.auth.roles();
    return roles.some(r => ['FleetManager', 'Dispatcher', 'BloodBikeAdmin'].includes(r));
  });

  readonly speedHistory = computed(() => this.summary()?.speedHistory ?? []);

  ngOnInit(): void {
    if (this.canViewAll()) {
      // Populate dropdown from the real riders list, always include self
      this.analyticsService.getRiders().pipe(
        catchError(() => of([] as RiderOption[]))
      ).subscribe(list => {
        const me = this.auth.username();
        // Ensure current user is always in the list
        if (me && !list.find(r => r.id === me)) {
          list = [{ id: me, name: me }, ...list];
        }
        this.riders.set(list);
        if (list.length === 1) {
          this.selectedRider = list[0].id;
          this.startPolling();
        }
      });
    } else {
      // Rider sees their own data — auto-select, no dropdown shown
      const me = this.auth.username();
      this.selectedRider = me;
      if (me) this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  onRiderChange(): void {
    this.summary.set(null);
    this.error.set(null);
    if (this.selectedRider) {
      this.startPolling();
    } else {
      this.pollSub?.unsubscribe();
    }
  }

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    if (!this.selectedRider) return;

    this.pollSub = interval(15_000).pipe(
      startWith(0),
      switchMap(() => {
        this.loading.set(true);
        return this.analyticsService.getSummary(this.selectedRider).pipe(
          catchError(err => {
            this.error.set(err?.error || 'Failed to load analytics');
            this.loading.set(false);
            return of(null);
          })
        );
      })
    ).subscribe(data => {
      if (data) {
        this.summary.set(data);
        this.error.set(null);
        this.lastRefresh.set(new Date());
      }
      this.loading.set(false);
    });
  }

  // --- Chart helpers ---

  yTicks(): Array<{ y: number; label: string }> {
    const hist = this.speedHistory();
    if (hist.length < 2) return [];
    const maxSpd = Math.max(...hist.map(p => p.speed), 10);
    const ceiling = Math.ceil(maxSpd / 20) * 20;
    const ticks: Array<{ y: number; label: string }> = [];
    for (let v = 0; v <= ceiling; v += 20) {
      ticks.push({ y: this.speedToY(v, ceiling), label: String(v) });
    }
    return ticks;
  }

  linePoints(): string {
    const hist = this.speedHistory();
    if (hist.length < 2) return '';
    const maxSpd = Math.max(...hist.map(p => p.speed), 10);
    const ceiling = Math.ceil(maxSpd / 20) * 20;
    const drawW = this.chartW - this.labelW - this.padR;
    return hist.map((p, i) => {
      const x = this.labelW + (i / (hist.length - 1)) * drawW;
      const y = this.speedToY(p.speed, ceiling);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  areaPoints(): string {
    const hist = this.speedHistory();
    if (hist.length < 2) return '';
    const maxSpd = Math.max(...hist.map(p => p.speed), 10);
    const ceiling = Math.ceil(maxSpd / 20) * 20;
    const drawW = this.chartW - this.labelW - this.padR;
    const bottom = this.chartH - this.padBot;
    const pts = hist.map((p, i) => {
      const x = this.labelW + (i / (hist.length - 1)) * drawW;
      const y = this.speedToY(p.speed, ceiling);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const firstX = this.labelW;
    const lastX = this.labelW + drawW;
    return `${firstX},${bottom} ${pts.join(' ')} ${lastX},${bottom}`;
  }

  private speedToY(speed: number, ceiling: number): number {
    const drawH = this.chartH - this.padTop - this.padBot;
    return this.padTop + drawH - (speed / ceiling) * drawH;
  }
}
