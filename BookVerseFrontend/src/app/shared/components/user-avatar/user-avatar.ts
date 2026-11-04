import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { UserService } from '../../../features/profile/services/user.service';
import { profileAvatar } from '../../../features/profile/models/profile-avatars';

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.html',
  styleUrl: './user-avatar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
    '[attr.role]': 'decorative() ? null : "img"',
    '[attr.aria-label]': 'decorative() ? null : "Avatar de " + displayName()',
  },
})
export class UserAvatar {
  private readonly users = inject(UserService);
  readonly userId = input<string | null>();
  readonly username = input<string | null>();
  readonly avatarIndex = input<number | null>();
  readonly decorative = input(true);

  readonly resolvedUserId = computed(() =>
    this.userId() === undefined ? (this.users.currentUser()?.idExternal ?? null) : this.userId(),
  );
  readonly displayName = computed(
    () =>
      (this.username() === undefined
        ? this.users.currentUser()?.username
        : this.username()
      )?.trim() || 'Usuario',
  );
  readonly initials = computed(() => {
    const parts = this.displayName().split(/\s+/);
    return (
      parts.length > 1
        ? parts
            .slice(0, 2)
            .map((part) => Array.from(part)[0])
            .join('')
        : Array.from(parts[0]).slice(0, 2).join('')
    ).toLocaleUpperCase();
  });
  readonly source = computed(() => {
    const override = this.avatarIndex();
    if (override !== undefined) return profileAvatar(override)?.src.trim() ?? null;
    const id = this.resolvedUserId();
    const appearance = id ? this.users.getCachedProfileAppearance(id) : undefined;
    return appearance?.configured
      ? (profileAvatar(appearance.avatarIndex)?.src.trim() ?? null)
      : null;
  });
  readonly imageFailed = linkedSignal({
    source: () => `${this.resolvedUserId() ?? ''}:${this.source() ?? ''}`,
    computation: () => false,
  });

  constructor() {
    effect((cleanup) => {
      const id = this.resolvedUserId();
      if (!id || this.avatarIndex() !== undefined) return;
      const request = this.users.getProfileAppearance(id).subscribe({ error: () => undefined });
      cleanup(() => request.unsubscribe());
    });
  }
}
