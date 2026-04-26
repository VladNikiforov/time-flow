export type RawData = {
  website: string;
  time: { start: number; end: number } | number;
};

export type FullData = {
  [date: string]: RawData[];
};
