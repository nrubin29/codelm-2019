import { Component, Input, OnInit } from '@angular/core';
import { DivisionModel } from '../../../../../../common/src/models/division.model';
import { TeamModel } from '../../../../../../common/src/models/team.model';
import { TeamService } from '../../../services/team.service';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  @Input() division: DivisionModel;
  teams: TeamModel[] = [];

  constructor(private teamService: TeamService) { }

  ngOnInit() {
    this.teamService.getTeamsForDivision(this.division._id).then(teams => this.teams = teams.sort(((a, b) => b.score - a.score)));
  }
}
