import { CommonModule } from '@angular/common';

import {Component,inject,OnInit,signal} from '@angular/core';

import {ActivatedRoute,RouterModule} from '@angular/router';

import { finalize } from 'rxjs';

import { StoryDetailResponse } from '../../models/story-detail-response';
import { StoryService } from '../../services/story.services';

@Component({
  selector: 'app-story-detail',
  standalone: true,
  imports: [CommonModule,RouterModule],
  templateUrl: './story-detail.html',
  styleUrl: './story-detail.css'
})
export class StoryDetail implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly storyService = inject(StoryService);

  readonly story =
    signal<StoryDetailResponse | null>(null);

  readonly isLoading =
    signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  ngOnInit(): void {

    const id =
      this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.errorMessage.set(
        'No pudimos identificar la historia.'
      );

      return;
    }

    this.loadStory(id);
  }

  private loadStory(
    idExternal: string
  ): void {

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.storyService
      .getById(idExternal)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        })
      )
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
}