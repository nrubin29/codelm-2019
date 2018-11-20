import { Request, Response, Router } from 'express';
import { ProblemDao, sanitizeProblem } from '../daos/problem.dao';
import {
  ClientProblemSubmission,
  ServerProblemSubmission
} from '../../../common/src/problem-submission';
import { isGradedProblem, ProblemModel, ProblemType } from '../../../common/src/models/problem.model';
import { isFalse, SubmissionDao } from '../daos/submission.dao';
import { PermissionsUtil } from '../permissions.util';
import {
  GradedSubmissionModel,
  SubmissionModel,
  TestCaseSubmissionModel,
  UploadSubmissionModel
} from '../../../common/src/models/submission.model';
import {execFile, spawn} from 'child_process';
import { SettingsDao } from '../daos/settings.dao';
import { SettingsState } from '../../../common/src/models/settings.model';
import {Game} from "../../../common/src/models/game.model";
import {GameResult} from "../../../coderunner/src/games/game.result";

const router = Router();

router.put('/', PermissionsUtil.requireAdmin, PermissionsUtil.requireSuperUser, async (req: Request, res: Response) => {
  res.json(await ProblemDao.addOrUpdateProblem(req.body as ProblemModel));
});

router.get('/:id', PermissionsUtil.requireAuth, async (req: Request, res: Response) => {
  let problem = await ProblemDao.getProblem(req.params.id);

  if (!req.params.admin) {
    problem = sanitizeProblem(problem);
  }

  res.json(problem);
});

router.delete('/:id', PermissionsUtil.requireAdmin, PermissionsUtil.requireSuperUser, async (req: Request, res: Response) => {
  await ProblemDao.deleteProblem(req.params.id);
  res.json(true);
});

router.get('/division/:id', PermissionsUtil.requireAuth, async (req: Request, res: Response) => {
  let problems = await ProblemDao.getProblemsForDivision(req.params.id);
  const settings = await SettingsDao.getSettings();

  if (!req.params.admin) {
    problems = problems.filter(problem => problem.divisions.findIndex(pD => pD.division._id.toString() === req.params.team.division._id.toString()) !== -1);

    if (settings.state === SettingsState.Graded) {
      problems = problems.filter(problem => settings.state === SettingsState.Graded && problem.type === ProblemType.Graded);
    }

    else if (settings.state === SettingsState.Upload) {
      problems = problems.filter(problem => settings.state === SettingsState.Upload && problem.type === ProblemType.OpenEnded);
    }

    problems.forEach(problem => sanitizeProblem(problem));
  }

  res.json(problems);
});

export default router;
