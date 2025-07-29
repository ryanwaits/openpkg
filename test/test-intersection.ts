export interface BaseOptions {
  name: string;
}

export interface NetworkParam {
  network?: { url: string };
}

export type CombinedOptions = BaseOptions & NetworkParam;

export function test(options: CombinedOptions): string {
  return options.name;
}