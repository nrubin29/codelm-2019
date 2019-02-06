import { Component, OnInit } from '@angular/core';
import {DashboardComponent} from "../dashboard/dashboard.component";
import {SubmissionStatusPacket} from "../../../../../../common/src/packets/submission.status.packet";
import {SubmissionCompletedPacket} from "../../../../../../common/src/packets/submission.completed.packet";
import {SubmissionPacket} from "../../../../../../common/src/packets/submission.packet";
import {VERSION} from "../../../../../../common/version";
import {SocketService} from "../../../services/socket.service";
import {ProblemService} from "../../../services/problem.service";
import {TeamService} from "../../../services/team.service";
import {GamePacket} from "../../../../../../common/src/packets/game.packet";

@Component({
  selector: 'app-highlow',
  templateUrl: './highlow.component.html',
  styleUrls: ['./highlow.component.scss']
})
export class HighlowComponent implements OnInit {
  log = [];

  constructor(private dashboardComponent: DashboardComponent, private problemService: ProblemService, private teamService: TeamService, private socketService: SocketService) { }

  ngOnInit() {
    this.dashboardComponent.toggle().then(() => {
      this.socketService.on<SubmissionStatusPacket>('submissionStatus', packet => {
        this.log.push('status: ' + JSON.stringify(packet.status) + '\n')
      });

      this.socketService.on<GamePacket>('game', packet => {
        this.log.push('data: ' + JSON.stringify(packet.data)+ '\n');
      });

      this.socketService.once<SubmissionCompletedPacket>('submissionCompleted', packet => {
        this.socketService.off('submissionStatus');
        this.socketService.off('game');

        // this.teamService.refreshTeam().then(() => {
          this.dashboardComponent.toggle().then(() => {
            // setTimeout(() => {
            // this.finished = true;
            // this.router.navigate(['dashboard', 'submission', packet._id]);
            // }, 200);
          });
        // });
      });

      this.socketService.emit(new SubmissionPacket(this.problemService.problemSubmission, this.teamService.team.getValue(), VERSION));
    });
  }

}
