import { Component, signal } from '@angular/core';
import { UserSearch } from '../../components/user-search/user-search';
import { FriendList } from '../../components/friend-list/friend-list';

@Component({
  selector: 'app-community',
  imports: [UserSearch, FriendList],
  template: `<main class="community-page">
    <header>
      <h1>Lectores</h1>
    </header>
    <nav class="reader-tabs" aria-label="Secciones de lectores">
      <button type="button" [class.active]="tab() === 'search'" [attr.aria-pressed]="tab() === 'search'" (click)="tab.set('search')">Buscar lectores</button>
      <button type="button" [class.active]="tab() === 'friends'" [attr.aria-pressed]="tab() === 'friends'" (click)="tab.set('friends')">Mis amigos</button>
    </nav>
    @if (tab() === 'search') { <app-user-search [searchOnly]="true" [showFriendAction]="true" /> }
    @else { <app-friend-list /> }
  </main>`,
  styleUrl: '../../community.css',
})
export class Community { readonly tab = signal<'search' | 'friends'>('search'); }
