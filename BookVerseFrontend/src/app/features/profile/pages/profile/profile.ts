import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { ReadingStatusResponse } from '../../../stories/models/reading-status-response';
import { ReadingStatusService } from '../../../stories/services/reading-status.service';
import { StoryService } from '../../../stories/services/story.services';
import { UserService } from '../../services/user.service';

@Component({
  imports: [RouterLink],
  selector: 'app-profile',
  styleUrl: './profile.css',
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  private readonly userService = inject(UserService);
  private readonly groupMembersService = inject(GroupMembersService);
  private readonly readingStatusService = inject(ReadingStatusService);
  private readonly storyService = inject(StoryService);

  readonly readingCounts = signal({
    wantToRead: '…',
    inProgress: '…',
    finished: '…',
  });

  readonly createdStoriesCount = signal('…');
  readonly activeGroupsCount = signal('…');

  @ViewChild('coverPicker')
  coverPicker!: ElementRef<HTMLDialogElement>;

  get profile() {
    const user = this.userService.currentUser();
    const username = user?.username?.trim() || 'Usuario';

    return {
      name: username,
      initials: username
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      username: `@${username}`,
      email: user?.email ?? '',
      accountStatus: user?.status === 'ACTIVE' ? 'ACTIVA' : 'INACTIVA',
      biography:
        'Colecciono frases bonitas, ideas nocturnas y libros para los que siempre tengo lugar.',
      interests: ['Fantasía', 'Ficción literaria', 'Un poco de magia'],
    };
  }

  get roleLabel(): string {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'USUARIO';

      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
      const claims: { roles?: string[] } = JSON.parse(atob(padded));

      if (claims.roles?.includes('ROLE_ADMIN')) return 'ADMIN';
      if (claims.roles?.includes('ROLE_MODERATOR')) return 'MODERADOR';
    } catch {
      return 'USUARIO';
    }

    return 'USUARIO';
  }

  logout(): void {
    this.userService.logout();
  }

  covers = [
    {
      src: '/assets/profile-writer.png',
      name: 'La narradora',
      alt: 'Una escritora rodeada de páginas luminosas en una biblioteca mágica',
      objectPosition: 'center 50%',
    },
    {
      src: '/assets/profile-reader.png',
      name: 'La soñadora',
      alt: 'Una lectora sentada sobre una torre de libros',
      objectPosition: 'center 40%',
    },
    {
      src: '/assets/library.jpg',
      name: 'La biblioteca encantada',
      alt: 'Una biblioteca encantada con libros flotantes',
      objectPosition: 'center 44%',
    },
    {
      src: '/assets/writers-desk-v2.png',
      name: 'Un mundo para escribir',
      alt: 'Un cuaderno abierto frente a un reino fantástico',
      objectPosition: 'center 62%',
    },
    {
      src: '/assets/login-library.png',
      name: 'Una puerta a las posibilidades',
      alt: 'Una puerta luminosa en un rincón de lectura',
      objectPosition: 'center 48%',
    },
    {
      src: '/assets/sign-in-library.png',
      name: 'Entre los estantes',
      alt: 'Una lectora frente a los estantes de una biblioteca',
      objectPosition: 'center 55%',
    },
  ];

  selectedCoverIndex = 0;

  ngOnInit(): void {
    this.userService.loadCurrentUser().subscribe({
      next: (user) => {
        if (user) {
          this.selectedCoverIndex = this.readSavedCoverIndex(user.idExternal);
        }
      },
      error: () => undefined,
    });

    this.readingStatusService.getMine().subscribe({
      next: (statuses) => {
        this.readingCounts.set(this.countStatuses(statuses));
      },
      error: () => {
        this.readingCounts.set({
          wantToRead: '—',
          inProgress: '—',
          finished: '—',
        });
      },
    });

    const userId = localStorage.getItem('userId');

    if (!userId) {
      this.updateGroupCount('—');
      this.createdStoriesCount.set('—');
      return;
    }

    this.groupMembersService.getActiveByUser(userId).subscribe({
      next: (memberships) => {
        this.updateGroupCount(String(memberships.length));
      },
      error: () => {
        this.updateGroupCount('—');
      },
    });

    this.storyService.getByAuthor(userId).subscribe({
      next: (page) => {
        this.createdStoriesCount.set(String(page.totalElements));
      },
      error: () => {
        this.createdStoriesCount.set('—');
      },
    });
  }

  private readSavedCoverIndex(userId: string): number {
    const saved = Number(localStorage.getItem(`profile-cover:${userId}`));

    return Number.isInteger(saved) &&
      saved >= 0 &&
      saved < this.covers.length
      ? saved
      : 0;
  }

  private countStatuses(statuses: ReadingStatusResponse[]) {
    return {
      wantToRead: String(
        statuses.filter((item) => item.status === 'WANT_TO_READ').length,
      ),
      inProgress: String(
        statuses.filter(
          (item) =>
            item.status === 'IN_PROGRESS' || item.status === 'RE_READING',
        ).length,
      ),
      finished: String(
        statuses.filter((item) => item.status === 'FINISHED').length,
      ),
    };
  }

  private updateGroupCount(value: string): void {
    this.activeGroupsCount.set(value);
  }

  get currentCover() {
    return this.covers[this.selectedCoverIndex];
  }

  openCoverPicker(): void {
    this.coverPicker.nativeElement.showModal();
  }

  closeCoverPicker(): void {
    this.coverPicker.nativeElement.close();
  }

  closeCoverPickerOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCoverPicker();
    }
  }

  selectCover(index: number): void {
    this.selectedCoverIndex = index;

    const userId = this.userService.currentUser()?.idExternal;
    if (userId) {
      localStorage.setItem(`profile-cover:${userId}`, String(index));
    }
  }
}
