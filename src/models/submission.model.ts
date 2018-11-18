import { GradedProblemModel, ProblemModel, UploadProblemModel } from './problem.model';
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
  team: TeamModel;
  problem: ProblemModel;
  points?: number;
  datetime?: Date;
}

export interface GradedSubmissionModel extends SubmissionModel {
  problem: GradedProblemModel;
  language: string;
  code: string;
  result?: string;
  test: boolean;
  overrideCorrect?: boolean;
  dispute?: DisputeModel;
  error?: string;
  testCases?: TestCaseSubmissionModel[];
}

export function isGradedSubmission(submission: SubmissionModel): submission is GradedSubmissionModel {
  return (submission as any).code !== undefined;
}

export interface SubmissionFileModel {
  name: string;
  contents: string;
}

export interface UploadSubmissionModel extends SubmissionModel {
  problem: UploadProblemModel;
  files: SubmissionFileModel[];
  score: number;
}

export function isUploadSubmission(submission: SubmissionModel): submission is UploadSubmissionModel {
  return (submission as any).files !== undefined;
}