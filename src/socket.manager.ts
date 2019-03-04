import { RegisterPacket } from '../../common/src/packets/register.packet';
import { LoginPacket } from '../../common/src/packets/login.packet';
import { sanitizeTeam, TeamDao } from './daos/team.dao';
import { AdminDao } from './daos/admin.dao';
import { Packet } from '../../common/src/packets/packet';
import { PermissionsUtil } from './permissions.util';
import { LoginResponse, LoginResponsePacket } from '../../common/src/packets/login.response.packet';
import { VERSION } from '../../common/version';
import { isClientPacket } from '../../common/src/packets/client.packet';
import {Server, Socket} from "socket.io";
import {SubmissionPacket} from "../../common/src/packets/submission.packet";
import {ClientProblemSubmission, ServerProblemSubmission} from "../../common/src/problem-submission";
import {ProblemDao} from "./daos/problem.dao";
import {isGradedProblem, isOpenEndedProblem} from "../../common/src/models/problem.model";
import {isFalse, SubmissionDao} from "./daos/submission.dao";
import {execFile, spawn} from "child_process";
import {
  GradedSubmissionModel,
  SubmissionModel,
  TestCaseSubmissionModel, UploadSubmissionModel
} from "../../common/src/models/submission.model";
import {Game} from "../../common/src/models/game.model";
import {GameResult} from "../../coderunner/src/games/game.result";
import {SubmissionStatusPacket} from "../../common/src/packets/submission.status.packet";
import {SubmissionCompletedPacket} from "../../common/src/packets/submission.completed.packet";
import {GamePacket} from "../../common/src/packets/game.packet";

export class SocketManager {
  private static _instance: SocketManager;

  private sockets: Map<string, Socket>;

  static get instance(): SocketManager {
    if (!SocketManager._instance) {
      throw new Error('SocketManager has not been initialized.');
    }

    return SocketManager._instance;
  }

  public static init(server: Server) {
    if (SocketManager._instance) {
      throw new Error('SocketManager has already been initialized.');
    }

    SocketManager._instance = new SocketManager(server);
  }

  public emit(userId: string, packet: Packet) {
    if (this.sockets.has(userId)) {
      this.emitToSocket(packet, this.sockets.get(userId))
    }
  }

  public emitToSocket(packet: Packet, socket: Socket) {
    socket.emit(packet.name, packet);
  }

  public emitToAll(packet: Packet) {
    this.sockets.forEach(socket => this.emitToSocket(packet, socket));
  }

  protected constructor(private server: Server) {
    this.sockets = new Map<string, Socket>();

    server.on('connection', socket => {
      let _id: string;

      socket.use((pkt, next) => {
        const packet = pkt[1];

        if (isClientPacket(packet) && packet.version !== VERSION) {
          this.emitToSocket(new LoginResponsePacket(LoginResponse.OutdatedClient), socket);
          socket.disconnect(true);
        }

        else {
          next();
        }
      });

      socket.on('login', packet => this.onLoginPacket(packet as LoginPacket, socket).then(__id => _id = __id));
      socket.on('register', packet => this.onRegisterPacket(packet as RegisterPacket, socket).then(__id => _id = __id));
      socket.on('submission', packet => this.onSubmissionPacket(packet as SubmissionPacket, socket));

      socket.once('disconnect', () => {
        if (_id) {
          this.sockets.delete(_id);
        }
      });
    });
  }

  onLoginPacket(loginPacket: LoginPacket, socket: Socket): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      TeamDao.login(loginPacket.username, loginPacket.password).then(team => {
        PermissionsUtil.hasAccess(team).then(access => {
          const response = access ? LoginResponse.SuccessTeam : LoginResponse.Closed;
          this.emitToSocket(new LoginResponsePacket(response, response === LoginResponse.SuccessTeam ? sanitizeTeam(team) : undefined), socket);

          if (response === LoginResponse.SuccessTeam) {
            this.sockets.set(team._id.toString(), socket);
            resolve(team._id);
          }

          else {
            socket.disconnect(true);
            reject();
          }
        });
      }).catch((response: LoginResponse | Error) => {
        if (response === LoginResponse.NotFound) {
          AdminDao.login(loginPacket.username, loginPacket.password).then(admin => {
            this.sockets.set(admin._id.toString(), socket);
            this.emitToSocket(new LoginResponsePacket(LoginResponse.SuccessAdmin, undefined, admin), socket);
            resolve(admin._id);
          }).catch((response: LoginResponse | Error) => {
            if ((response as any).stack !== undefined) {
              console.error(response);
              this.emitToSocket(new LoginResponsePacket(LoginResponse.Error), socket);
            }

            else {
              this.emitToSocket(new LoginResponsePacket(response as LoginResponse), socket);
            }

            socket.disconnect(true);
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

          socket.disconnect(true);
          reject();
        }
      });
    });
  }

  onRegisterPacket(packet: RegisterPacket, socket: Socket): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const registerPacket = packet as RegisterPacket;
      TeamDao.register(registerPacket.teamData).then(team => {
        this.onLoginPacket({name: 'login', username: registerPacket.teamData.username, password: registerPacket.teamData.password, version: registerPacket.version}, socket)
          .then(resolve)
          .catch(reject);
      }).catch((response: LoginResponse | Error) => {
        if ((response as any).stack !== undefined) {
          console.error(response);
          this.emitToSocket(new LoginResponsePacket(LoginResponse.Error), socket);
        }

        else {
          this.emitToSocket(new LoginResponsePacket(response as LoginResponse), socket);
        }

        socket.disconnect(true);
        reject();
      });
    });
  }

  // TODO: Ensure that submissions are open (use PermissionsUtil).
  async onSubmissionPacket(packet: SubmissionPacket, socket: Socket) {
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

    else {
      // TODO: Get from problem
      serverProblemSubmission.game = Game.HighLow;
    }

    const process = spawn('docker', ['run', '-i', '--rm', '--cap-drop', 'ALL', '--net=none', 'coderunner']);
    const testCases: TestCaseSubmissionModel[] = [];
    let stderr = '';

    process.stdout.on('data',  (data: Buffer) => {
      // Sometimes, two packets will be read at once. This ensures that they are treated separately.
      for (let packet of data.toString().split(new RegExp('(?<=})\n'))) {
        // Every packet ends with a \n, so the last element of the split will always be empty, and we want to skip it.
        if (!packet) {
          continue;
        }

        const obj = JSON.parse(packet.trim());

        if (obj.hasOwnProperty('status')) {
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
    process.stderr.on('data', (data: Buffer) => stderr += data.toString());

    process.on('exit', async () => {
      let submission: SubmissionModel;

      if (stderr.length > 0) {
        let err;

        try {
          err = JSON.parse(stderr).error;
        }

        catch {
          err = stderr;
        }

        submission = await SubmissionDao.addSubmission({
          type: isGradedProblem(problem) ? 'graded' : 'upload',
          team: packet.team,
          problem: problem,
          language: problemSubmission.language,
          code: problemSubmission.code,
          error: err,
          test: problemSubmission.test
        } as GradedSubmissionModel);
      } else {
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

      this.emitToSocket(new SubmissionCompletedPacket(submission._id), socket);

      /*
      // or
      const submission = await SubmissionDao.addSubmission({
          team: packet.team,
          problem: problem,
          score: (<GameResult>JSON.parse(lastData)).score
        } as UploadSubmissionModel);
       */
    });

    process.stdin.write(JSON.stringify(serverProblemSubmission) + '\n');
    process.stdin.end();
  }
}
