import {CodeRunner} from './coderunner';
import {ServerProblemSubmission} from '../../common/src/problem-submission';
import {ProblemType} from "../../common/src/models/problem.model";
import {Game} from "../../common/src/models/game.model";
import {HighLow} from "./games/high-low";
import {languages} from "./language";
import {CodeFile} from "./codefile";

const stdin = process.openStdin();
stdin.once('data', async data => {
  const submission = JSON.parse(data) as ServerProblemSubmission;
  const language = languages[submission.language];

  let runner = new CodeRunner(language, 'code', [new CodeFile(submission.problemTitle.replace(' ', '') + '.' + language.extension, submission.code)]);

  await runner.setup();

  runner.output.subscribe(next => process.stdout.write(JSON.stringify(next) + '\n'));

  try {
    if (submission.type === ProblemType.OpenEnded) {
      if (submission.game === Game.HighLow) {
        await runner.runGame(new HighLow());
      }

      else {
        console.error(JSON.stringify({error: 'Invalid game ' + submission.game}));
      }
    }

    else {
      await runner.run(submission.testCases);
    }
  }

  catch (e) {
    console.error(JSON.stringify(e));
  }
});
