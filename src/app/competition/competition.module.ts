import { NgModule } from '@angular/core';
import { CountdownComponent } from './components/countdown/countdown.component';
import { DashboardComponent } from './views/dashboard/dashboard.component';
import { ProblemComponent } from './views/problem/problem.component';
import { StandingsComponent } from './views/standings/standings.component';
import { SubmitComponent } from './views/submit/submit.component';
import { SharedModule } from '../shared.module';
import { CompetitionRoutingModule } from './competition.routing';
import { HighlowComponent } from './views/highlow/highlow.component';
import { TimesweeperComponent } from './views/timesweeper/timesweeper.component';

@NgModule({
  declarations: [
    CountdownComponent,
    DashboardComponent,
    ProblemComponent,
    StandingsComponent,
    SubmitComponent,
    HighlowComponent,
    TimesweeperComponent
  ],
  imports: [
    SharedModule,
    CompetitionRoutingModule
  ]
})
export class CompetitionModule { }
