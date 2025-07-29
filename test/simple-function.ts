/**
 * Very simple test file
 */

export interface Options {
  name: string;
  value: number;
}

export interface Result {
  ok: boolean;
  message: string;
}

/**
 * A simple function
 * @param options - The options
 * @returns The result
 */
export function simpleFunction(options: Options): Result {
  return {
    ok: true,
    message: `Hello ${options.name}`,
  };
}