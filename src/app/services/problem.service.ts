import { Injectable } from '@angular/core';
import { RestService } from './rest.service';
import { ProblemModel } from '../../../../common/src/models/problem.model';
import { TestCaseSubmissionModel } from '../../../../common/src/models/submission.model';
import { ClientProblemSubmission } from '../../../../common/src/problem-submission';
import {SocketService} from "./socket.service";

@Injectable({
  providedIn: 'root'
})
export class ProblemService {
  private endpoint = 'problems';

  // This holds a ClientProblemSubmission from problem.component and gives it to submit.component.
  private _problemSubmission: ClientProblemSubmission;

  get problemSubmission() {
    const temp = this._problemSubmission;
    this._problemSubmission = undefined;
    return temp;
  }

  get peekProblemSubmission() {
    return this._problemSubmission;
  }

  set problemSubmission(value: ClientProblemSubmission) {
    this._problemSubmission = value;
  }

  constructor(private restService: RestService) { }

  getProblem(id: string): Promise<ProblemModel> {
    return this.restService.get<ProblemModel>(`${this.endpoint}/${id}`);
  }

  getProblems(divisionId: string): Promise<ProblemModel[]> {
    return this.restService.get<ProblemModel[]>(`${this.endpoint}/division/${divisionId}`);
  }

  addOrUpdateProblem(problem: any): Promise<ProblemModel> {
    // problem should be a ProblemModel but division is a string[] rather than a DivisionModel[].
    return this.restService.put<ProblemModel>(this.endpoint, problem);
  }

  deleteProblem(problemId: string): Promise<void> {
    return this.restService.delete<void>(`${this.endpoint}/${problemId}`);
  }
}
