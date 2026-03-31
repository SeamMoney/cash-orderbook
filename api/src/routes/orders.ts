/**
 * GET /orders/:address — Open orders for a specific address.
 *
 * Path params:
 *   - address: Aptos hex address (must start with 0x, 1-66 hex chars)
 *
 * Returns [{ orderId, price, quantity, remaining, side, type }]
 */

import { Hono } from "hono";
import { z } from "zod";
import type { OrderbookState } from "../state/orderbook-state.js";

/** Aptos address validation: starts with 0x followed by 1-64 hex chars */
const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, "Invalid Aptos address format");

export function ordersRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.get("/orders/:address", (c) => {
    const address = c.req.param("address");

    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) {
      return c.json(
        {
          error: "INVALID_ADDRESS",
          message: "Address must be a valid Aptos hex address (0x followed by 1-64 hex characters)",
        },
        400,
      );
    }

    const orders = state.getOrdersForAddress(parsed.data);

    const response = orders.map((o) => ({
      orderId: o.orderId,
      price: o.price,
      quantity: o.quantity,
      remaining: o.remaining,
      side: o.side,
      type: o.type,
    }));

    return c.json(response);
  });

  return app;
}
