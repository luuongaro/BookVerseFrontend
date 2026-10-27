import { CommonModule } from '@angular/common';

import {
  Component,
  inject,
  OnInit,
  signal
} from '@angular/core';

import {
  ActivatedRoute,
  RouterModule
} from '@angular/router';

import { finalize } from 'rxjs';

import { ChapterResponse } from '../../models/chapter-response';
import { ChapterService } from '../../services/chapter.service';
import { Sidebar } from '../../../../shared/components/sidebar/sidebar';
import { StoryDetailResponse } from '../../models/story-detail-response';
import { StoryService } from '../../services/story.services';

@Component({
  selector: 'app-chapter-list',
  standalone: true,
  imports: [CommonModule,RouterModule,Sidebar],
  templateUrl: './chapter-list.html',
  styleUrl: './chapter-list.css'
})
export class ChapterList implements OnInit {

  private readonly route = inject(ActivatedRoute);

  private readonly chapterService = inject(ChapterService);

  private readonly storyService = inject(StoryService);

  readonly storyId = signal<string | null>(null);

  readonly chapters = signal<ChapterResponse[]>([]);

  readonly isLoading = signal(false);

  readonly errorMessage = signal<string | null>(null);

  readonly story = signal<StoryDetailResponse | null>(null);

ngOnInit(): void {

  const id = this.route.snapshot.paramMap.get('id');

  this.storyId.set(id);

  if (!id) {
    this.errorMessage.set(
      'No pudimos identificar la historia.'
    );

    return;
  }

  this.loadStory(id);
  this.loadChapters(id);
}

  private loadStory(
  storyId: string
): void {

  this.storyService
    .getById(storyId)
    .subscribe({

      next: story => {
        this.story.set(story);
      },

      error: () => {
        this.errorMessage.set(
          'No pudimos cargar la historia.'
        );
      }

    });
}
  
  private loadChapters(
    storyId: string
  ): void {

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.chapterService
      .getByStory(storyId)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe({

        next: response => {
          this.chapters.set(
            response.content ?? []
          );
        },

        error: () => {
          this.errorMessage.set(
            'No pudimos cargar los capítulos.'
          );
        }

      });
  }
}