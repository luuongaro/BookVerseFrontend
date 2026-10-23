import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-story-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './story-detail.html',
  styleUrl: './story-detail.css'
})
export class StoryDetail {

  story = signal({

    title: 'Cartas para la Luna',

    description:
      'Cada noche Elara escribe una carta.',

    accessType: 'FREE',

    chaptersCount: 4,

    chapters: [
      {
        chapterNumber: 1,
        title: 'La primera carta',
        published: true
      },
      {
        chapterNumber: 2,
        title: 'La respuesta',
        published: false
      }
    ]
  });

}