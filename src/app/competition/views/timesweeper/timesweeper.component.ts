import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {SubmissionStatusPacket} from "../../../../../../common/src/packets/submission.status.packet";
import {GamePacket} from "../../../../../../common/src/packets/game.packet";
import {SubmissionCompletedPacket} from "../../../../../../common/src/packets/submission.completed.packet";
import {MatTable} from "@angular/material";
import {DashboardComponent} from "../dashboard/dashboard.component";
import {ProblemService} from "../../../services/problem.service";
import {TeamService} from "../../../services/team.service";
import {SocketService} from "../../../services/socket.service";
import {isPacket} from "../../../../../../common/src/packets/packet";
import {SubmissionPacket} from "../../../../../../common/src/packets/submission.packet";
import {VERSION} from "../../../../../../common/version";

@Component({
  selector: 'app-timesweeper',
  templateUrl: './timesweeper.component.html',
  styleUrls: ['./timesweeper.component.scss']
})
export class TimesweeperComponent implements OnInit, AfterViewInit {
  queue: (SubmissionStatusPacket | GamePacket | SubmissionCompletedPacket)[] = [];
  log: object[] = [];

  status = 'Preparing';
  error: string;
  _id: string;

  @ViewChild('htmlLog') htmlLog: ElementRef<HTMLDivElement>;
  @ViewChild(MatTable) table: MatTable<object>;
  @ViewChild('board') board: ElementRef<HTMLTableSectionElement>;
  range: number[];

  constructor(private dashboardComponent: DashboardComponent, private problemService: ProblemService, private teamService: TeamService, private socketService: SocketService) { }

  ngOnInit() {
    this.range = new Array(10);
  }

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
            if (packet.data.hasOwnProperty('input')) {
              const line: string[] = packet.data['input'].split(' ');

              if (line.length === 100) {
                for (let i = 0; i < 100; i++) {
                  this.board.nativeElement.children[Math.floor(i / 10)].children[i % 10].innerHTML = line[i];
                }

                const guess: number[] = packet.data['output'].split(' ').map(x => parseInt(x));
                const cell = this.board.nativeElement.children[Math.floor(guess[0])].children[guess[1]] as HTMLElement;

                if (line[Math.floor(guess[0] * 10 + guess[1])] === '7') {
                  cell.style.background = 'lightgreen';
                }

                else {
                  cell.style.background = 'yellow';
                }

                // cell.style.color = 'white';
              }
            }

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
