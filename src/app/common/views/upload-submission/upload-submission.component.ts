import {Component, Input, OnInit, ViewChild} from '@angular/core';
import { SubmissionComponent } from '../submission/submission.component';
import { UploadSubmissionModel } from '../../../../../../common/src/models/submission.model';
import { SubmissionService } from '../../../services/submission.service';
import {CodeMirrorComponent} from "../../components/code-mirror/code-mirror.component";
import {CodeSaverService} from "../../../services/code-saver.service";

@Component({
  selector: 'app-upload-submission',
  templateUrl: './upload-submission.component.html',
  styleUrls: ['./upload-submission.component.scss']
})
export class UploadSubmissionComponent implements OnInit {
  @Input() submission: UploadSubmissionModel;
  score: number;

  mode: string;
  @ViewChild(CodeMirrorComponent) codeMirror: CodeMirrorComponent;

  constructor(private submissionComponent: SubmissionComponent, private submissionService: SubmissionService, private codeSaverService: CodeSaverService) {
  }

  ngOnInit() {
    this.mode = this.codeSaverService.getMode(this.submission.language);
    this.codeMirror.writeValue(this.submission.code);
  }

  setScore() {
    this.submission.score = this.score;
    this.submissionService.updateSubmission(this.submission).then(() => {
      this.submission.points = this.score;
      alert('Updated');
    }).catch(alert);
  }

  delete() {
    this.submissionComponent.delete();
  }

  get admin() {
    return this.submissionComponent.admin;
  }
}
