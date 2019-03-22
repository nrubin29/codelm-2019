import {RegisterPacket} from '../../common/src/packets/register.packet';
import {LoginPacket} from '../../common/src/packets/login.packet';
import {sanitizeTeam, TeamDao} from './daos/team.dao';
import {AdminDao} from './daos/admin.dao';
import {Packet} from '../../common/src/packets/packet';
import {PermissionsUtil} from './permissions.util';
import {LoginResponse, LoginResponsePacket} from '../../common/src/packets/login.response.packet';
import {VERSION} from '../../common/version';
import {isClientPacket} from '../../common/src/packets/client.packet';
import {SubmissionPacket} from "../../common/src/packets/submission.packet";
import {ServerProblemSubmission} from "../../common/src/problem-submission";
import {ProblemDao} from "./daos/problem.dao";
import {isGradedProblem, isOpenEndedProblem, ProblemModel} from "../../common/src/models/problem.model";
import {isFalse, SubmissionDao} from "./daos/submission.dao";
import {spawn} from "child_process";
import {
  GradedSubmissionModel,
  SubmissionModel,
  TestCaseSubmissionModel
} from "../../common/src/models/submission.model";
import {SubmissionStatusPacket} from "../../common/src/packets/submission.status.packet";
import {SubmissionCompletedPacket} from "../../common/src/packets/submission.completed.packet";
import {GamePacket} from "../../common/src/packets/game.packet";
import * as WebSocket from 'ws';
import {Express} from "express";
import {WithWebsocketMethod} from "express-ws";
import {ReplayPacket} from "../../common/src/packets/replay.packet";

export class SocketManager {
  private static _instance: SocketManager;

  private sockets: Map<string, WebSocket>;

  static get instance(): SocketManager {
    if (!SocketManager._instance) {
      throw new Error('SocketManager has not been initialized.');
    }

    return SocketManager._instance;
  }

  public static init(app: Express) {
    if (SocketManager._instance) {
      throw new Error('SocketManager has already been initialized.');
    }

    SocketManager._instance = new SocketManager(app);
  }

  public emit(userId: string, packet: Packet) {
    if (this.sockets.has(userId)) {
      this.emitToSocket(packet, this.sockets.get(userId))
    }
  }

  public emitToSocket(packet: Packet, socket: WebSocket) {
    socket.send(JSON.stringify(packet));
  }

  public emitToAll(packet: Packet) {
    this.sockets.forEach(socket => this.emitToSocket(packet, socket));
  }

  protected constructor(app: Express) {
    this.sockets = new Map<string, WebSocket>();

    setInterval(() => {
      // This is apparently necessary to stop the random disconnecting.
      this.sockets.forEach(socket => socket.ping());
    }, 15 * 1000);

    (app as any as WithWebsocketMethod).ws('/', socket => {
      let _id: string;

      socket.onmessage = (data) => {
        const packet = JSON.parse(<string>data.data);

        if (isClientPacket(packet) && packet.version !== VERSION) {
          this.emitToSocket(new LoginResponsePacket(LoginResponse.OutdatedClient), socket);
          socket.close();
        }

        else {
          socket.listeners(packet.name).map(listener => listener(packet));
        }
      };

      socket.on('login', packet => this.onLoginPacket(packet as LoginPacket, socket).then(__id => _id = __id).catch(() => {}));
      socket.on('register', packet => this.onRegisterPacket(packet as RegisterPacket, socket).then(__id => _id = __id).catch(() => {}));
      socket.on('submission', packet => this.onSubmissionPacket(packet as SubmissionPacket, socket).catch(() => {}));
      socket.on('replay', packet => this.onReplayPacket(packet as ReplayPacket, socket).catch(() => {}));

      socket.onclose = () => {
        if (_id) {
          this.sockets.delete(_id);
        }
      };
    });
  }

  onLoginPacket(loginPacket: LoginPacket, socket: WebSocket): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      TeamDao.login(loginPacket.username, loginPacket.password).then(team => {
        if (this.sockets.has(team._id.toString())) {
          this.emitToSocket(new LoginResponsePacket(LoginResponse.AlreadyConnected), socket);
          socket.close();
          reject();
        }

        else {
          PermissionsUtil.hasAccess(team).then(access => {
            const response = access ? LoginResponse.SuccessTeam : LoginResponse.Closed;
            this.emitToSocket(new LoginResponsePacket(response, response === LoginResponse.SuccessTeam ? sanitizeTeam(team) : undefined), socket);

            if (response === LoginResponse.SuccessTeam) {
              this.sockets.set(team._id.toString(), socket);
              resolve(team._id.toString());
            }

            else {
              socket.close();
              reject();
            }
          });
        }
      }).catch((response: LoginResponse | Error) => {
        if (response === LoginResponse.NotFound) {
          AdminDao.login(loginPacket.username, loginPacket.password).then(admin => {
            if (this.sockets.has(admin._id.toString())) {
              this.emitToSocket(new LoginResponsePacket(LoginResponse.AlreadyConnected), socket);
              socket.close();
              reject();
            }

            else {
              this.sockets.set(admin._id.toString(), socket);
              this.emitToSocket(new LoginResponsePacket(LoginResponse.SuccessAdmin, undefined, admin), socket);
              resolve(admin._id.toString());
            }
          }).catch((response: LoginResponse | Error) => {
            if ((response as any).stack !== undefined) {
              console.error(response);
              this.emitToSocket(new LoginResponsePacket(LoginResponse.Error), socket);
            }

            else {
              this.emitToSocket(new LoginResponsePacket(response as LoginResponse), socket);
            }

            socket.close();
            reject();
          });
        }

        else {
          if ((response as any).stack !== undefined) {
            console.error(response);
            this.emitToSocket(new LoginResponsePacket(LoginResponse.Error), socket);
          }

          else {
            this.emitToSocket(new LoginResponsePacket(response as LoginResponse), socket);
          }

          socket.close();
          reject();
        }
      });
    });
  }

  onRegisterPacket(packet: RegisterPacket, socket: WebSocket): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const registerPacket = packet as RegisterPacket;
      PermissionsUtil.canRegister().then(canRegister => {
        if (canRegister) {
          TeamDao.register(registerPacket.teamData).then(team => {
            this.emitToSocket(new LoginResponsePacket(LoginResponse.SuccessTeam, sanitizeTeam(team)), socket);
            this.sockets.set(team._id.toString(), socket);
            resolve(team._id);
          }).catch((response: LoginResponse | Error) => {
            if ((response as any).stack !== undefined) {
              console.error(response);
              this.emitToSocket(new LoginResponsePacket(LoginResponse.Error), socket);
            }

            else {
              this.emitToSocket(new LoginResponsePacket(response as LoginResponse), socket);
            }

            socket.close();
            reject();
          });
        }

        else {
          this.emitToSocket(new LoginResponsePacket(LoginResponse.Closed), socket);
          socket.close();
          reject();
        }
      });
    });
  }

  // TODO: Ensure that submissions are open (use PermissionsUtil).
  async onSubmissionPacket(packet: SubmissionPacket, socket: WebSocket) {
    const problemSubmission = packet.submission;
    const problem = await ProblemDao.getProblem(problemSubmission.problemId);

    const serverProblemSubmission: ServerProblemSubmission = {
      problemTitle: problem.title,
      type: problem.type,
      language: problemSubmission.language,
      code: problemSubmission.code
    };

    if (isGradedProblem(problem)) {
      serverProblemSubmission.testCases = problem.testCases.filter(testCase => isFalse(problemSubmission.test.toString()) || !testCase.hidden);
    }

    else if (isOpenEndedProblem(problem)) {
      serverProblemSubmission.game = problem.game;
    }

    const {testCases, err} = await this.runSubmission(serverProblemSubmission, problem, socket);
    let submission: SubmissionModel;

    if (err) {
      submission = await SubmissionDao.addSubmission({
        type: isGradedProblem(problem) ? 'graded' : 'upload',
        team: packet.team,
        problem: problem,
        language: problemSubmission.language,
        code: problemSubmission.code,
        error: err,
        test: problemSubmission.test
      } as GradedSubmissionModel);
    }

    else {
      submission = await SubmissionDao.addSubmission({
        type: isGradedProblem(problem) ? 'graded' : 'upload',
        team: packet.team,
        problem: problem,
        language: problemSubmission.language,
        code: problemSubmission.code,
        testCases: testCases,
        test: problemSubmission.test
      } as GradedSubmissionModel);
    }

    /*
    // or
    const submission = await SubmissionDao.addSubmission({
      team: packet.team,
      problem: problem,
      score: (<GameResult>JSON.parse(lastData)).score
    } as UploadSubmissionModel);
    */

    this.emitToSocket(new SubmissionCompletedPacket(submission._id), socket);
  }

  async onReplayPacket(packet: ReplayPacket, socket: WebSocket) {
    const submission = await SubmissionDao.getSubmission(packet.replayRequest._id);

    const serverProblemSubmission: ServerProblemSubmission = {
      problemTitle: submission.problem.title,
      type: submission.problem.type,
      language: submission.language,
      code: submission.code
    };

    if (isGradedProblem(submission.problem)) {
      serverProblemSubmission.testCases = submission.problem.testCases.filter(testCase => isFalse(submission.test.toString()) || !testCase.hidden);
    }

    else if (isOpenEndedProblem(submission.problem)) {
      serverProblemSubmission.game = submission.problem.game;
    }

    await this.runSubmission(serverProblemSubmission, submission.problem, socket);
    this.emitToSocket(new SubmissionCompletedPacket(submission._id), socket);
  }

  private runSubmission(serverProblemSubmission: ServerProblemSubmission, problem: ProblemModel, socket: WebSocket): Promise<{testCases: TestCaseSubmissionModel[], err: string}> {
    return new Promise<{testCases: TestCaseSubmissionModel[], err: string}>(resolve => {
      const process = spawn('docker', ['run', '-i', '--rm', '--cap-drop', 'ALL', '--net=none', 'coderunner']);
      const testCases: TestCaseSubmissionModel[] = [];
      const errors = [];

      process.stdout.on('data',  (data: Buffer) => {
        // Sometimes, two packets will be read at once. This ensures that they are treated separately.
        for (let packet of data.toString().split(/(?<=})\n/g)) {
          // Every packet ends with a \n, so the last element of the split will always be empty, and we want to skip it.
          if (!packet) {
            continue;
          }

          const obj = JSON.parse(packet.trim());
          console.log(obj);

          if (obj.hasOwnProperty('error')) {
            errors.push(obj['error']);

            if (!isGradedProblem(problem)) {
              this.emitToSocket(new GamePacket(obj), socket);
            }
          }

          else if (obj.hasOwnProperty('status')) {
            this.emitToSocket(new SubmissionStatusPacket(obj['status']), socket);
          }

          else if (obj.hasOwnProperty('testCase')) {
            testCases.push(obj['testCase']);
            this.emitToSocket(new SubmissionStatusPacket('test case completed'), socket);
          }

          else if (isOpenEndedProblem(problem)) {
            this.emitToSocket(new GamePacket(obj), socket);
          }

          else {
            throw new Error('Unknown object from container: ' + JSON.stringify(obj));
          }
        }
      });

      // TODO: What if an error occurs in the middle of running?
      process.stderr.on('data', (data: Buffer) => {
        throw new Error(data.toString());
      });

      process.on('exit', async () => {
        let err = undefined;

        if (errors.length > 0) {
          err = errors.join('\n');
        }

        resolve({testCases, err});
      });

      process.stdin.write(JSON.stringify(serverProblemSubmission) + '\n');
      process.stdin.end();
    });
  }
}
