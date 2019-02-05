import { execFile, spawn } from 'child_process';
import { TestCaseModel } from '../../common/src/models/problem.model';
import { TestCaseSubmissionModel } from '../../common/src/models/submission.model';
import { Subject } from 'rxjs';
import Game from "./games/game";
import {Language} from "./language";
import {CodeFile} from "./codefile";
import * as fs from "fs-extra";

interface RunResult {
  output: string;
}

interface ProcessRunResult {
  output: string;
  error: string;
}

export type TestCaseRunResult = TestCaseSubmissionModel & RunResult;

export interface RunError {
  stage: 'compile' | 'run';
  testCase?: number;
  error: string;
}

export class CodeRunner {
  public output: Subject<object>;

  constructor(private language: Language, public folder: string, public files: CodeFile[]) {
    this.output = new Subject<object>();
    this.files.concat(this.language.files || []);
  }

  private runProcessSync(cmd: string, args: string[], input?: string): Promise<ProcessRunResult> {
    return new Promise<ProcessRunResult>((resolve, reject) => {
      try {
        const process = execFile(cmd, args, { cwd: this.folder, timeout: 5000 }, (err: Error & {signal: string}, stdout, stderr) => {
          let error;

          if (err && err.signal === 'SIGTERM') {
            error = 'Timed out';
          }

          resolve({output: stdout.replace(/^\s+|\s+$/g, ''), error: error ? error : stderr.replace(/^\s+|\s+$/g, '')});
        });

        if (input) {
          process.stdin.write(input + '\n');
          process.stdin.end();
        }
      }

      catch (e) {
        reject(e);
      }
    });
  }

  protected runProcessAsync(cmd: string, args: ReadonlyArray<string>, game: Game): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // TODO: If no output, event never triggers.
        const process = spawn(cmd, args, {cwd: this.folder});

        process.stdout.on('data', (data: Buffer) => {
          const result = game.onInput(data.toString());
          // TODO: If this line runs twice in a very short timespan, the container will output two JSON objects on the same line.
          this.output.next({input: result, output: data.toString()});

          if (typeof result === 'string') {
            process.stdin.write(result + '\n');
          }

          else {
            process.kill();
            resolve();
          }
        });

        // TODO: Handle stderr correctly.
        process.stderr.on('data', (data: Buffer) => {
          console.error(data.toString());
        });

        // process.on('exit', () => {
        //   resolve();
        // });

        // setTimeout(() => {
        //
        // }, 5000);
      }

      catch (e) {
        reject(e);
      }
    });
  }

  protected async compile(): Promise<RunResult> {
    const compileCmd = this.language.compile(this.files.map(file => file.name));

    const {output, error} = await this.runProcessSync(compileCmd[0], compileCmd.slice(1));

    if (error.length > 0) {
      throw {
        stage: 'compile',
        error: error
      };
    }

    else {
      return {
        output: output
      };
    }
  }

  protected async runTestCase(testCase: TestCaseModel): Promise<TestCaseRunResult> {
    const runCmd = this.language.run(this.files.map(file => file.name));

    const {output, error} = await this.runProcessSync(runCmd[0], runCmd.slice(1), testCase.input);

    if (error.length > 0) {
      throw {
        stage: 'run',
        error: error
      };
    }

    else {
      return {
        hidden: testCase.hidden,
        input: testCase.input,
        output: output,
        correctOutput: testCase.output
      };
    }
  }

  async setup() {
    if (await fs.pathExists(this.folder)) {
      await fs.remove(this.folder);
    }

    await fs.mkdir(this.folder);

    await Promise.all(this.files.map(file => file.mkfile(this.folder)));

    this.output.next({status: 'compiling'});

    try {
      await this.compile();
      this.output.next({status: 'setup complete'});
    }

    catch (e) {
      await this.cleanUp();
      throw e;
    }
  }

  async run(testCases: TestCaseModel[]): Promise<void> {
    try {
      this.output.next({status: 'running'});

      for (let testCase of testCases) {
        const result = await this.runTestCase(testCase);
        this.output.next({testCase: result});
      }
    }

    finally {
      await this.cleanUp();
    }
  }

  async runGame(game: Game): Promise<void> {
    const runCmd = this.language.run(this.files.map(file => file.name));

    try {
      this.output.next({status: 'running'});
      await this.runProcessAsync(runCmd[0], runCmd.slice(1), game);
    }

    finally {
      await this.cleanUp();
    }
  }

  async cleanUp() {
    this.output.next({status: 'cleaning up'});
    await fs.remove(this.folder);
  }
}