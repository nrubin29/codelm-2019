import Game from "./game";
import {GameResult} from "./game.result";

export class HighLow implements Game {
  name = 'High Low';
  answer: number;
  guesses: number;

  constructor() {
    this.answer = Math.floor(Math.random() * 100) + 1;
    this.guesses = 0;
  }

  onInput(data: string): string | GameResult {
    this.guesses++;
    const guess = parseInt(data);

    if (isNaN(guess)) {
      return {error: 'invalid guess'};
    }

    else if (guess > this.answer) {
      return '1';
    }

    else if (guess < this.answer) {
      return '-1';
    }

    else {
      return {score: this.guesses};
    }
  }
}
