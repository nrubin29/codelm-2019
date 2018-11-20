import {ProblemType, TestCaseModel} from './models/problem.model';
import {Game} from "./models/game.model";

export interface ClientProblemSubmission {
  problemId: string;
  language: string;
  code: string;
  test: boolean;
}

export interface ServerProblemSubmission {
  problemTitle: string;
  type: ProblemType;
  game?: Game;
  testCases?: TestCaseModel[];
  language: string;
  code: string;
}
