import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  EMPTY,
  catchError,
  expand,
  map,
  switchMap,
  timer,
  toArray,
} from 'rxjs';
import { PageResponse } from '../../../stories/models/page-response';
import { UserProfile } from '../../models/user-profile.model';
import { UserService } from '../../services/user.service';
import { FriendAction } from '../friend-action/friend-action';

@Component({
  selector: 'app-user-search',
  imports: [UserAvatar, RouterLink, FriendAction],
  templateUrl: './user-search.html',
  styleUrl: './user-search.css',
})
export class UserSearch implements OnInit {
  private readonly users = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new BehaviorSubject({ query: '', page: 0 });

  @Input() selectable = false;
  @Input() searchOnly = false;
  @Input() showFriendAction = false;
  @Input() hidePagination = false;
  @Input() hideExistingMembers = false;
  @Input() memberIds: readonly string[] = [];
  @Input() disabled = false;
  @Input() selectedUserId: string | null = null;
  @Output() userSelected = new EventEmitter<UserProfile>();

  readonly profiles = signal<UserProfile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  query = '';

  get hasQuery(): boolean {
    return !!this.query.trim().replace(/^@/, '').trim();
  }

  get availableProfiles(): UserProfile[] {
    return this.hideExistingMembers
      ? this.profiles().filter((user) => !this.memberIds.includes(user.idExternal))
      : this.profiles();
  }

  ngOnInit(): void {
    this.requests
      .pipe(
        switchMap(({ query, page }) => {
          this.loading.set(true);
          this.error.set('');
          this.profiles.set([]);
          if (this.searchOnly && !query.trim()) {
            this.loading.set(false);
            this.totalPages.set(0);
            return EMPTY;
          }
          return timer(query ? 250 : 0).pipe(
            switchMap(() => this.users.searchProfiles(query, page)),
            expand((result) =>
              this.hidePagination && result.number + 1 < result.totalPages
                ? this.users.searchProfiles(query, result.number + 1)
                : EMPTY,
            ),
            toArray(),
            map((pages): PageResponse<UserProfile> => {
              const firstPage = pages[0]!;

              if (!this.hidePagination) {
                return firstPage;
              }

              return {
                ...firstPage,
                content: pages.flatMap((pageResult) => pageResult.content),
                number: 0,
                totalPages: 1,
                first: true,
                last: true,
              };
            }),
            catchError(() => {
              this.loading.set(false);
              this.error.set('No pudimos cargar los usuarios. Intentá de nuevo.');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.profiles.set(result.content);
        this.page.set(result.number);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      });
  }

  search(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
    this.request(0);
  }

  request(page: number): void {
    this.page.set(page);
    this.requests.next({ query: this.query.trim().replace(/^@/, '').trim(), page });
  }

  select(user: UserProfile): void {
    if (!this.disabled && !this.memberIds.includes(user.idExternal)) this.userSelected.emit(user);
  }

}
