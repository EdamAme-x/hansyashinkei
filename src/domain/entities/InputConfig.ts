export interface InputBinding {
  code: string;
  ballIndex: number;
}

export interface InputConfig {
  dodge: InputBinding[];
  start: string[];
}
