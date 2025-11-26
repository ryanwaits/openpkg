/**
 * Class with property type drift.
 */
export class UserProfile {
  /**
   * The user's age.
   * @type {string}
   */
  age: number = 0;

  /**
   * The user's name.
   * @type {number}
   */
  name: string = '';

  /**
   * Control case: correctly documented property.
   * @type {boolean}
   */
  active: boolean = true;
}

/**
 * Interface with property type drift in implementation.
 */
export interface ConfigOptions {
  /**
   * The timeout value in milliseconds.
   * @type {string}
   */
  timeout: number;

  /**
   * Control case: correctly documented.
   * @type {string}
   */
  label: string;
}
