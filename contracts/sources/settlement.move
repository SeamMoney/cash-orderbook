/// Settlement module for the Cash Orderbook.
/// Handles post-match asset transfers and event emission.
///
/// On a trade fill:
///   - Base asset (CASH) transfers from seller's locked balance to buyer's available balance
///   - Quote asset (USDC) transfers from buyer's locked balance to seller's available balance
///   - Amounts: base_amount = fill_quantity, quote_amount = (fill_price * fill_quantity) / PRICE_SCALE
///   - Emits TradeEvent and OrderFilled events for indexer consumption
module cash_orderbook::settlement {
    use std::vector;
    use aptos_framework::event;
    use cash_orderbook::types;
    use cash_orderbook::accounts;
    use cash_orderbook::market;
    use cash_orderbook::matching::{Self, Trade};
    use cash_orderbook::fees;

    // ========== Events ==========

    #[event]
    struct TradeEvent has drop, store {
        /// Taker order ID
        taker_order_id: u64,
        /// Maker order ID
        maker_order_id: u64,
        /// Fill price (maker's price)
        price: u64,
        /// Fill quantity (base asset units)
        quantity: u64,
        /// Quote amount transferred (quote asset units)
        quote_amount: u64,
        /// Buyer address
        buyer: address,
        /// Seller address
        seller: address,
        /// Market pair ID
        pair_id: u64,
        /// Whether the taker was the buyer (true) or seller (false)
        taker_is_bid: bool,
    }

    #[event]
    struct OrderFilled has drop, store {
        /// The order ID that was filled (either taker or maker)
        order_id: u64,
        /// How much was filled in this trade
        fill_quantity: u64,
        /// Fill price
        fill_price: u64,
        /// Owner of the filled order
        owner: address,
        /// Market pair ID
        pair_id: u64,
    }

    // ========== Settlement Functions ==========

    /// Settle all trades from a matching round.
    /// For each trade:
    ///   - Transfer base asset (CASH): seller locked -> buyer available
    ///   - Transfer quote asset (USDC): buyer locked -> seller available
    ///   - Emit TradeEvent and OrderFilled events
    public(friend) fun settle_trades(
        trades: &vector<Trade>,
        pair_id: u64,
    ) {
        let (base_asset, quote_asset) = market::get_market_assets(pair_id);
        let price_scale = types::price_scale();

        let i = 0;
        let len = vector::length(trades);
        while (i < len) {
            let trade = vector::borrow(trades, i);
            settle_single_trade(trade, base_asset, quote_asset, price_scale);
            i = i + 1;
        };
    }

    /// Settle a single trade.
    /// After calculating quote_amount, fees are computed and deducted:
    ///   - Taker fee: deducted from the taker's side (buyer pays more, or seller receives less)
    ///   - Maker fee: deducted from the maker's side
    ///   - Fees are credited to the fee vault via fees::collect_fee()
    ///   - When fees are 0 (default), no deduction occurs (backward compatible)
    fun settle_single_trade(
        trade: &Trade,
        base_asset: address,
        quote_asset: address,
        price_scale: u64,
    ) {
        let fill_price = matching::trade_price(trade);
        let fill_quantity = matching::trade_quantity(trade);
        let buyer = matching::trade_buyer(trade);
        let seller = matching::trade_seller(trade);
        let pair_id = matching::trade_pair_id(trade);
        let taker_order_id = matching::trade_taker_order_id(trade);
        let maker_order_id = matching::trade_maker_order_id(trade);
        let taker_is_bid = matching::trade_taker_is_bid(trade);

        // Calculate quote amount: (price * quantity) / PRICE_SCALE
        // Use u128 to prevent overflow
        let quote_amount = (((fill_price as u128) * (fill_quantity as u128)) / (price_scale as u128) as u64);

        // Calculate fees
        let taker_fee = fees::calculate_taker_fee(quote_amount);
        let maker_fee = fees::calculate_maker_fee(quote_amount);
        let total_fee = taker_fee + maker_fee;

        // Transfer base asset (CASH): seller's locked -> buyer's available
        // The seller had locked their CASH when placing a sell order
        accounts::debit_locked(seller, base_asset, fill_quantity);
        accounts::credit_available(buyer, base_asset, fill_quantity);

        // Transfer quote asset (USDC) with fees deducted from LOCKED balances.
        //
        // The buyer's quote is LOCKED (not available), so fees must be deducted
        // from locked balances during settlement. Extra quote was locked at order
        // placement time to cover fees.
        //
        // For buy taker (taker_is_bid = true):
        //   Buyer (taker) pays: quote_amount + taker_fee (from locked)
        //   Seller (maker) gets: quote_amount - maker_fee (credited to available)
        //   Vault gets: taker_fee + maker_fee
        //
        // For sell taker (taker_is_bid = false):
        //   Buyer (maker) pays: quote_amount + maker_fee (from locked)
        //   Seller (taker) gets: quote_amount - taker_fee (credited to available)
        //   Vault gets: taker_fee + maker_fee
        // Calculate the max fee that was locked at order placement time
        let max_fee = fees::calculate_max_fee(quote_amount);

        if (taker_is_bid) {
            // Buyer is taker: debit quote_amount + taker_fee from buyer's locked.
            // The excess fee reserve (max_fee - taker_fee) is handled by
            // order_placement's excess unlock calculation.
            accounts::debit_locked(buyer, quote_asset, quote_amount + taker_fee);
            // Seller (maker) receives quote_amount minus their maker fee
            accounts::credit_available(seller, quote_asset, quote_amount - maker_fee);
        } else {
            // Buyer is maker (resting bid): debit quote_amount + maker_fee from locked.
            accounts::debit_locked(buyer, quote_asset, quote_amount + maker_fee);
            // Unlock the excess fee reserve for the maker (no order_placement running
            // for the maker, so we must unlock here).
            // Maker locked max_fee per unit at placement; only maker_fee was consumed.
            let excess_fee = max_fee - maker_fee;
            if (excess_fee > 0) {
                accounts::unlock_balance(buyer, quote_asset, excess_fee);
            };
            // Seller (taker) receives quote_amount minus their taker fee
            accounts::credit_available(seller, quote_asset, quote_amount - taker_fee);
        };

        // Collect total fees to the fee vault
        if (total_fee > 0) {
            let taker_addr = if (taker_is_bid) { buyer } else { seller };
            let maker_addr = if (taker_is_bid) { seller } else { buyer };
            if (taker_fee > 0) {
                fees::collect_fee(quote_asset, taker_fee, false, taker_addr);
            };
            if (maker_fee > 0) {
                fees::collect_fee(quote_asset, maker_fee, true, maker_addr);
            };
        };

        // Emit TradeEvent
        event::emit(TradeEvent {
            taker_order_id,
            maker_order_id,
            price: fill_price,
            quantity: fill_quantity,
            quote_amount,
            buyer,
            seller,
            pair_id,
            taker_is_bid,
        });

        // Emit OrderFilled for both taker and maker
        event::emit(OrderFilled {
            order_id: taker_order_id,
            fill_quantity,
            fill_price,
            owner: if (taker_is_bid) { buyer } else { seller },
            pair_id,
        });

        event::emit(OrderFilled {
            order_id: maker_order_id,
            fill_quantity,
            fill_price,
            owner: if (taker_is_bid) { seller } else { buyer },
            pair_id,
        });
    }

    // ========== Friend Declarations ==========
    friend cash_orderbook::order_placement;
}
