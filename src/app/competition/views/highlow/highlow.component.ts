import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {DashboardComponent} from "../dashboard/dashboard.component";
import {SubmissionStatusPacket} from "../../../../../../common/src/packets/submission.status.packet";
import {SubmissionCompletedPacket} from "../../../../../../common/src/packets/submission.completed.packet";
import {SubmissionPacket} from "../../../../../../common/src/packets/submission.packet";
import {VERSION} from "../../../../../../common/version";
import {SocketService} from "../../../services/socket.service";
import {ProblemService} from "../../../services/problem.service";
import {TeamService} from "../../../services/team.service";
import {GamePacket} from "../../../../../../common/src/packets/game.packet";
import {MatTable} from "@angular/material";
import {isPacket} from "../../../../../../common/src/packets/packet";

@Component({
  selector: 'app-highlow',
  templateUrl: './highlow.component.html',
  styleUrls: ['./highlow.component.scss']
})
export class HighlowComponent implements AfterViewInit {
  queue: (SubmissionStatusPacket | GamePacket | SubmissionCompletedPacket)[] = [];
  log: object[] = [];

  status = 'Preparing';
  error: string;
  _id: string;

  @ViewChild('htmlLog') htmlLog: ElementRef<HTMLDivElement>;
  @ViewChild(MatTable) table: MatTable<object>;

  constructor(private dashboardComponent: DashboardComponent, private problemService: ProblemService, private teamService: TeamService, private socketService: SocketService) { }

  ngAfterViewInit() {
    this.dashboardComponent.toggle().then(() => {
      this.socketService.on<SubmissionStatusPacket>('submissionStatus', packet => {
        this.queue.push(packet);
      });

      this.socketService.on<GamePacket>('game', packet => {
        // TODO: If there's an error, clear the queue before putting the packet on.
        // TODO: Show errors correctly.
        if (packet.data.hasOwnProperty('error')) {
          this.error = packet.data['error'];
          this.queue = []; // TODO: Maybe this is a bad idea?
          return;
        }

        else if (packet.data.hasOwnProperty('input')) {
          if (typeof packet.data['input'] == 'object') {
            if (packet.data['input'].hasOwnProperty('error')) {
              this.error = packet.data['input']['error'];
              this.queue = []; // TODO: Maybe this is a bad idea?
              return;
            }

            else if (packet.data['input'].hasOwnProperty('score')) {
              // TODO: Save score.
              packet.data['input'] = 'Correct';
            }
          }

          else {
            packet.data['input'] = packet.data['input'] === '1' ? 'Too high' : packet.data['input'] === '-1' ? 'Too low': 'unknown';
          }
        }

        this.queue.push(packet);
      });

      this.socketService.once<SubmissionCompletedPacket>('submissionCompleted', packet => {
        this.socketService.off('submissionStatus');
        this.socketService.off('game');
        this.queue.push(packet);
      });

      const interval = setInterval(() => {
        if (this.queue.length > 0) {
          const packet = this.queue.shift();

          if (isPacket<SubmissionCompletedPacket>(packet, 'submissionCompleted')) {
            clearInterval(interval);

            // this.teamService.refreshTeam().then(() => {
            this.dashboardComponent.toggle().then(() => {
              this.status = 'Finished';
              this._id = packet._id;
              // setTimeout(() => {
              // this.finished = true;
              // this.router.navigate(['dashboard', 'submission', packet._id]);
              // }, 200);
            });
            // });
          }

          else if (isPacket<SubmissionStatusPacket>(packet, 'submissionStatus')) {
            this.status = packet.status;
          }

          else {
            this.log.push(packet.data);
            this.table.renderRows();
            this.htmlLog.nativeElement.scrollTop = this.htmlLog.nativeElement.scrollHeight;
          }
        }
      }, 500);

      this.socketService.emit(new SubmissionPacket(this.problemService.problemSubmission, this.teamService.team.getValue(), VERSION));
    });
  }

}
