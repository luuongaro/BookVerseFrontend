import { DatePipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GroupMember } from '../../models/group-member.model';
import { ReadingGroup } from '../../models/reading-group.model';
import { GroupMembersService } from '../../services/group-members.service';
import { ReadingGroupsService } from '../../services/reading-groups.service';

@Component({
  selector: 'app-group-detail',
  imports: [DatePipe, RouterLink],
  styleUrl: './group-detail.css',
  templateUrl: './group-detail.html',
})
export class GroupDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly groupMembersService = inject(GroupMembersService);

  group: ReadingGroup | null = null;
  members: GroupMember[] = [];

  isLoading = true;
  isLoadingMembers = true;
  errorMessage = '';
  membersErrorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const groupId = params.get('id');

      if (!groupId) {
        this.errorMessage = 'No se encontró el identificador del grupo.';
        this.isLoading = false;
        this.isLoadingMembers = false;
        this.changeDetector.markForCheck();
        return;
      }

      this.loadGroup(groupId);
      this.loadMembers(groupId);
    });
  }

  private loadGroup(groupId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.readingGroupsService.getById(groupId).subscribe({
      next: (group) => {
        this.group = group;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading reading group:', error);
        this.errorMessage = 'No se pudo cargar el círculo de lectura.';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadMembers(groupId: string): void {
    this.isLoadingMembers = true;
    this.membersErrorMessage = '';

    this.groupMembersService.getActiveByGroup(groupId).subscribe({
      next: (members) => {
        this.members = members;
        this.isLoadingMembers = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading group members:', error);
        this.membersErrorMessage = 'No se pudieron cargar los miembros.';
        this.isLoadingMembers = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}