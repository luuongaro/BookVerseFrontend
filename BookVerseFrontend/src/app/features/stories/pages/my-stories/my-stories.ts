import { Component } from '@angular/core';
import { StoryList } from '../story-list/story-list';
@Component({
  selector: 'app-my-stories',
  imports: [StoryList],
  templateUrl: './my-stories.html',
  styleUrl: './my-stories.css',
})
export class MyStories {}
