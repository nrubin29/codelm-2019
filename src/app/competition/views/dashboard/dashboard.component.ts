import { Component, OnInit, ViewChild } from '@angular/core';
import { ProblemModel } from '../../../../../../common/src/models/problem.model';
import { TeamService } from '../../../services/team.service';
import { ProblemService } from '../../../services/problem.service';
import { MatDrawerToggleResult, MatSidenav } from '@angular/material';
import { TeamModel } from '../../../../../../common/src/models/team.model';
import { SocketService } from '../../../services/socket.service';
import { Packet } from '../../../../../../common/src/packets/packet';
import { SubmissionUtil } from '../../../../../../common/src/utils/submission.util';
import { SubmissionModel } from '../../../../../../common/src/models/submission.model';
import { SubmissionService } from '../../../services/submission.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  team: TeamModel;
  private submissions: SubmissionModel[];
  problems: ProblemModel[] = [];

  @ViewChild(MatSidenav) private sideNav: MatSidenav;

  constructor(private problemService: ProblemService, private teamService: TeamService, private submissionService: SubmissionService, private socketService: SocketService) { }

  ngOnInit() {
    this.socketService.on('updateTeam', () => this.teamService.refreshTeam());

    this.teamService.team.subscribe(team => {
      this.team = team;

      this.submissionService.getSubmissions().then(submissions => {
        this.submissions = submissions;

        this.problemService.getProblems(this.team.division._id).then(problems => {
          this.problems = problems;
        });
      });
    });
  }

  toggle(): Promise<MatDrawerToggleResult> {
    return this.sideNav.toggle();
  }

  didSolve(problem: ProblemModel) {
    return SubmissionUtil.getSolution(problem, this.submissions);
  }
}
