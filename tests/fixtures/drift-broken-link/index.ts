/**
 * Broken link: references exports that don't exist.
 *
 * See {@link MissingType} for the type definition.
 * Also see {@link processOrder} for a valid reference.
 * And {@link unknownFunction} which doesn't exist.
 */
export function processOrder(id: string): string {
  return `Order: ${id}`;
}

/**
 * Broken link to a typo'd export name.
 *
 * Uses {@link OrderServce} instead of {@link OrderService}.
 */
export function getOrderService(): OrderService {
  return new OrderService();
}

/**
 * Control case: valid links only.
 *
 * See {@link OrderService} for the service class.
 * And {@link processOrder} for order processing.
 */
export function validateOrder(id: string): boolean {
  return id.length > 0;
}

/** The order service class */
export class OrderService {
  process(id: string): string {
    return processOrder(id);
  }
}

