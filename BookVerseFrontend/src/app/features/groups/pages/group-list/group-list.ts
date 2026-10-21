import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadingGroup } from '../../models/reading-group.model';
import { ReadingGroupsService } from '../../services/reading-groups.service';

@Component({
  selector: 'app-group-list',
  imports: [DatePipe, RouterLink],
  styleUrl: './group-list.css',
  templateUrl: './group-list.html',
})
export class GroupList implements OnInit {
  private readonly readingGroupsService = inject(ReadingGroupsService);

  groups: ReadingGroup[] = [];
  searchTerm = '';
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadGroups();
  }

  private loadGroups(): void {
    const userId = localStorage.getItem('userId');

    if (!userId) {
      this.errorMessage = 'No se encontró el usuario de la sesión.';
      this.isLoading = false;
      return;
    }

    this.readingGroupsService.getCreatedByUser(userId).subscribe({
      next: (groups) => {
        this.groups = groups;
      },
      error: (error: unknown) => {
        console.error('Error al cargar los grupos del usuario:', error);
        this.errorMessage = 'No se pudieron cargar tus grupos de lectura.';
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  get filteredGroups(): ReadingGroup[] {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.groups;
    }

    return this.groups.filter((group) =>
      group.name.toLowerCase().includes(query),
    );
  }
}