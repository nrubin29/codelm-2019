import {GameResult} from "./game.result";

export default interface Game {
    name: string;
    onInput(data: string): string | GameResult;
}