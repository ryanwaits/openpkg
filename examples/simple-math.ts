/**
 * Represents a 2D point in space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Represents a 3D point in space
 */
export interface Point3D extends Point {
  z: number;
}

/**
 * Represents a rectangle
 */
export interface Rectangle {
  topLeft: Point;
  bottomRight: Point;
}

/**
 * Math constants
 */
export enum MathConstants {
  PI = 3.14159,
  E = 2.71828,
  GOLDEN_RATIO = 1.61803,
}

/**
 * Calculates the distance between two points
 * @param a First point
 * @param b Second point
 * @returns The Euclidean distance
 */
export function distance(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

/**
 * Calculates the area of a rectangle
 * @param rect The rectangle
 * @returns The area
 */
export function area(rect: Rectangle): number {
  const width = rect.bottomRight.x - rect.topLeft.x;
  const height = rect.bottomRight.y - rect.topLeft.y;
  return Math.abs(width * height);
}

/**
 * Vector operations utility class
 */
export class Vector {
  constructor(
    public x: number,
    public y: number,
  ) {}

  /**
   * Adds another vector to this one
   */
  add(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  /**
   * Calculates the magnitude of the vector
   */
  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Normalizes the vector
   */
  normalize(): Vector {
    const mag = this.magnitude();
    return new Vector(this.x / mag, this.y / mag);
  }
}

/**
 * Type alias for a coordinate tuple
 */
export type Coordinate = [number, number];

/**
 * Type alias for a transformation matrix
 */
export type Matrix2D = [[number, number], [number, number]];

/**
 * The origin point
 */
export const ORIGIN: Point = { x: 0, y: 0 };

/**
 * Identity matrix
 */
export const IDENTITY_MATRIX: Matrix2D = [
  [1, 0],
  [0, 1],
];
