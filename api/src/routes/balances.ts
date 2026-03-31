/**
 * GET /balances/:address — User balances endpoint.
 *
 * Path params:
 *   - address: Aptos hex address (must start with 0x, 1-64 hex chars)
 *
 * Returns { cash: { available, locked }, usdc: { available, locked } }
 */

import { Hono } from "hono";
import { z } from "zod";
import type { OrderbookState } from "../state/orderbook-state.js";

/** Aptos address validation: starts with 0x followed by 1-64 hex chars */
const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, "Invalid Aptos address format");

export function balancesRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.get("/balances/:address", (c) => {
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

    const balances = state.getBalances(parsed.data);
    return c.json(balances);
  });

  return app;
}
