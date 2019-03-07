import {SettingsState} from "./settings.model";

export enum DivisionType {
  Competition = 'Competition',
  Preliminaries = 'Preliminaries',
  Special = 'Special'
}

export interface StarterCode {
  state: SettingsState;
  file: Buffer;
}

export interface DivisionModel {
  _id: string;
  name: string;
  type: DivisionType,
  starterCode: StarterCode[]
}
