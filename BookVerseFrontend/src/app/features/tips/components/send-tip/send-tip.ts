import {
  Component,
  DestroyRef,
  InjectionToken,
  Input,
  OnChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TipService } from '../../services/tip.service';

export const CHECKOUT_REDIRECT = new InjectionToken<(url: string) => void>('CHECKOUT_REDIRECT', {
  providedIn: 'root',
  factory: () => (url) => window.location.assign(url),
});

@Component({
  selector: 'app-send-tip',
  template: `<button
      type="button"
      class="tip-button"
      [disabled]="pending() || !storyId"
      (click)="send()"
    >
      @if (pending()) {
        Preparando pago…
      } @else {
        <span>Apoyar al autor</span>
        <span class="tip-amount">$1.000</span>
      }
    </button>
    @if (error()) {
      <p class="tip-error" role="alert">{{ error() }}</p>
    }`,
  styles: `
    :host {
      display: block;
    }
    .tip-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      max-width: 100%;
      min-height: 44px;
      padding: 11px 16px;
      border: 1px solid #ded4ec;
      border-radius: 12px;
      background: #faf7fd;
      color: #665498;
      font:
        500 13px/1.4 'DM Sans',
        Arial,
        sans-serif;
      cursor: pointer;
    }
    .tip-button:hover:not(:disabled) {
      border-color: #bca9d6;
      background: #f0e9f8;
    }
    .tip-button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .tip-button:focus-visible {
      outline: 2px solid #7465ad;
      outline-offset: 3px;
    }
    .tip-amount {
      padding-left: 12px;
      border-left: 1px solid #ded4ec;
      color: #7d6a9e;
      font-size: 12px;
      white-space: nowrap;
    }
    .tip-error {
      max-width: 320px;
      color: #a44d68;
      font-size: 12px;
      line-height: 1.5;
      margin: 8px 0 0;
    }
  `,
})
export class SendTip implements OnChanges {
  private readonly tips = inject(TipService);
  private readonly redirect = inject(CHECKOUT_REDIRECT);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  @Input({ required: true }) storyId = '';
  @Input() recipientName = '';
  readonly pending = signal(false);
  readonly error = signal('');

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.pending.set(false);
    this.error.set('');
  }

  send(): void {
    if (!this.storyId || this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    this.request = this.tips
      .createTip({
        storyId: this.storyId,
        amount: 1000,
        message: this.recipientName ? `Apoyo para ${this.recipientName}` : 'Apoyo a esta historia',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.pending.set(false);
          try {
            const url = new URL(result.checkout.checkoutUrl);
            if (url.protocol !== 'https:') throw new Error('Invalid checkout');
            this.redirect(url.href);
          } catch {
            this.error.set('No pudimos abrir el pago. Intentá de nuevo.');
          }
        },
        error: () => {
          this.pending.set(false);
          this.error.set('No pudimos iniciar el pago. Intentá de nuevo más tarde.');
        },
      });
  }
}
