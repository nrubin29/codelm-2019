import Game from "./game";
import {GameResult} from "./game.result";

export class Timesweeper implements Game {
  fullBoard: number[][];
  playerBoard: number[][];
  guesses: number;

  constructor() {
    this.fullBoard = [];
    this.playerBoard = [];
    this.guesses = 0;

    // Generate empty boards
    for (let i = 0; i < 10; i++) {
      this.fullBoard.push(new Array(10).fill(0));
      this.playerBoard.push(new Array(10).fill(-1));
    }

    // Place people
    for (let i = 0; i < 6; i++) {
      let row, col;

      do {
        row = Math.floor(Math.random() * 10);
        col = Math.floor(Math.random() * 10);
      } while (this.fullBoard[row][col] !== 0);

      this.fullBoard[row][col] = 7;
    }

    const isPerson = x => x === 7 ? 1 : 0;

    const countNeighbors = (row, col) => {
      let sum = 0;

      if (this.fullBoard[row - 1]) {
        sum += isPerson(this.fullBoard[row - 1][col - 1]) +
          isPerson(this.fullBoard[row - 1][col]) +
          isPerson(this.fullBoard[row - 1][col + 1]);
      }

      if (this.fullBoard[row]) {
        sum += isPerson(this.fullBoard[row][col + 1]) +
          isPerson(this.fullBoard[row][col - 1])
      }

      if (this.fullBoard[row + 1]) {
        sum += isPerson(this.fullBoard[row + 1][col + 1]) +
          isPerson(this.fullBoard[row + 1][col]) +
          isPerson(this.fullBoard[row + 1][col - 1])
      }

      return sum
    };

    // Fill in numbers
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (this.fullBoard[row][col] !== 7) {
          this.fullBoard[row][col] = countNeighbors(row, col);
        }
      }
    }
  }

  private contains(needle, haystack) {
    for (let element of haystack) {
      if (JSON.stringify(needle) === JSON.stringify(element)) {
        return true;
      }
    }

    return false;
  };

  private uncover(row, col, base=true, visited=[]) {
    visited.push([row, col]);

    if (this.playerBoard[row] !== undefined && this.playerBoard[row][col] !== undefined) {
      if (base || this.fullBoard[row][col] === 0) {
        this.playerBoard[row][col] = this.fullBoard[row][col];
      }

      if (this.playerBoard[row][col] === 0) {
        for (let i = -1; i < 2; i++) {
          for (let j = -1; j < 2; j++) {
            if (!this.contains([row + i, col + j], visited)) {
              this.uncover(row + i, col + j, false, visited);
            }
          }
        }
      }
    }
  };

  private finished() {
    let numSevens = 0;

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (this.playerBoard[row][col] === 7) {
          numSevens++;
        }
      }
    }

    return numSevens === 6;
  };

  onInput(data: string): string | GameResult {
    this.guesses++;

    // TODO: Validate response.
    const split = data.split(' ').map(x => parseInt(x));
    const row = split[0], col = split[1];

    if (this.finished()) {
      return {score: this.guesses};
    }

    else {
      this.uncover(row, col);
      return this.playerBoard.map(r => r.join(' ')).join(' ');
    }
  }
}
