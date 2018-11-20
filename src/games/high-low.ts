import Game from "./game";
import {GameResult} from "./game.result";

export class HighLow implements Game {
  name = 'High Low';
  answer: number;
  guesses: number;

  constructor() {
    this.answer = Math.random() * 100;
    this.guesses = 0;
  }

  onInput(data: string): string | GameResult {
    this.guesses++;
    const guess = parseInt(data);

    if (guess > this.answer) {
      return 'Too high';
    }

    else if (guess < this.answer) {
      return 'Too low';
    }

    else {
      return {score: this.guesses};
    }
  }
}