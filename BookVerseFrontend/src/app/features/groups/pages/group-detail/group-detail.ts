import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReadingGroup } from '../../models/reading-group.model';
import { ReadingGroupsService } from '../../services/reading-groups.service';

@Component({
  selector: 'app-group-detail',
  imports: [DatePipe, RouterLink],
  styleUrl: './group-detail.css',
  templateUrl: './group-detail.html',
})
export class GroupDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly readingGroupsService = inject(ReadingGroupsService);

  group: ReadingGroup | null = null;
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const groupId = params.get('id');

      if (!groupId) {
        this.errorMessage = 'No se encontró el identificador del grupo.';
        this.isLoading = false;
        return;
      }

      this.loadGroup(groupId);
    });
  }

  private loadGroup(groupId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.readingGroupsService.getById(groupId).subscribe({
      next: (group) => {
        this.group = group;
      },
      error: (error: unknown) => {
        console.error('Error loading reading group:', error);
        this.errorMessage = 'No se pudo cargar el círculo de lectura.';
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }
}