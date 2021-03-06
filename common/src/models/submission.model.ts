import { GradedProblemModel, ProblemModel, OpenEndedProblemModel } from './problem.model';
import { TeamModel } from './team.model';

// Optional values are generated by Mongoose or MongoDB

export interface TestCaseSubmissionModel {
  hidden: boolean;
  input: string;
  output: string;
  correctOutput: string;
  correct?: boolean;
}

export interface DisputeModel {
  open: boolean;
  message: string;
}

export interface SubmissionModel {
  _id?: string;
  type: 'graded' | 'upload';
  team: TeamModel;
  problem: ProblemModel;
  points?: number;
  datetime?: Date;
  language: string;
  code: string;
  test: boolean;
}

export interface GradedSubmissionModel extends SubmissionModel {
  type: 'graded';
  problem: GradedProblemModel;
  result?: string;
  overrideCorrect?: boolean;
  dispute?: DisputeModel;
  error?: string;
  testCases?: TestCaseSubmissionModel[];
}

export function isGradedSubmission(submission: SubmissionModel): submission is GradedSubmissionModel {
  return submission.type === 'graded';
}

export interface UploadSubmissionModel extends SubmissionModel {
  type: 'upload';
  problem: OpenEndedProblemModel;
  score: number;
}

export function isUploadSubmission(submission: SubmissionModel): submission is UploadSubmissionModel {
  return submission.type === 'upload';
}
