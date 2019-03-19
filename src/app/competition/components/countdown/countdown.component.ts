import { Component, OnInit } from '@angular/core';
import * as moment from 'moment';
import { Moment } from 'moment';
import { Router } from '@angular/router';
import { SettingsService } from '../../../services/settings.service';
import { SocketService } from '../../../services/socket.service';
import { SettingsModel, SettingsState } from '../../../../../../common/src/models/settings.model';
import {StateSwitchPacket} from '../../../../../../common/src/packets/state.switch.packet';

@Component({
  selector: 'app-countdown',
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.scss']
})
export class CountdownComponent implements OnInit {
  private settings: SettingsModel;
  private interval: NodeJS.Timer;

  end: Moment;
  countdown: string;

  constructor(private socketService: SocketService, private settingsService: SettingsService, private router: Router) { }

  ngOnInit() {
    this.socketService.on('updateSettings', () => {
      this.settingsService.getSettings().then(settings => {
        this.settings = settings;
        this.setup();
      });
    });

    this.socketService.on<StateSwitchPacket>('stateSwitch', packet => {
      switch (packet.newState) {
        case SettingsState.End:
          this.router.navigate(['/end']);
          break;
        case SettingsState.Closed:
          this.router.navigate(['/login']);
          break;
      }
    });

    this.settingsService.getSettings().then(settings => {
      this.settings = settings;
      this.setup();
    });
  }

  private setup() {
    if (this.interval !== undefined) {
      clearInterval(this.interval);
    }

    const schedule = this.settings.schedule.filter(schedule => moment().isBefore(moment(schedule.when))).sort(schedule => moment(schedule.when).unix());

    const tick = () => {
      if (!this.end) {
        return;
      }

      if (moment().isAfter(this.end)) {
        clearInterval(this.interval);
        this.countdown = '00:00:00';
      }

      else {
        // TODO: Only display days if > 1 day remains.
        const diff = moment.duration(this.end.diff(moment()));
        this.countdown = [
          diff.hours(), diff.minutes(), diff.seconds()
        ].map(x => this.pad(x)).join(':');
      }
    };

    if (schedule.length > 0) {
      this.end = moment(schedule[0].when);

      tick();
      this.interval = setInterval(tick, 500);
    }
  }

  private pad(x: number, size: number = 2) {
    let s = x.toString();

    while (s.length < size) {
      s = '0' + s;
    }

    return s;
  }
}
