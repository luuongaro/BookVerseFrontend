import {Component,OnInit,signal} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { StoryResponse } from '../../models/story-response';
import { StoryAccessType } from '../../models/story-access-type';

@Component({
  selector: 'app-story-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './story-list.html',
  styleUrl: './story-list.css'
})
export class StoryList implements OnInit {

  stories = signal<StoryResponse[]>([]);

  ngOnInit(): void {

    // Mock temporal

    this.stories.set([
  {
    idExternal: '1',
    authorId: '1',
    title: 'Cartas para la Luna',
    description: 'Cada noche Elara le escribe una carta a la luna.',
    accessType: StoryAccessType.FREE,
    hidden: false,
    deleted: false,
    createdAt: '',
    updatedAt: '',
    chaptersCount: 4
  },
  {
    idExternal: '2',
    authorId: '1',
    title: 'El Atlas de los Sueños',
    description: 'Un cartógrafo descubre un mundo imposible.',
    accessType: StoryAccessType.PREMIUM,
    hidden: false,
    deleted: false,
    createdAt: '',
    updatedAt: '',
    chaptersCount: 12
  }
    ]);

   }

}