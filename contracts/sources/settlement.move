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

        // Transfer base asset (CASH): seller's locked -> buyer's available
        // The seller had locked their CASH when placing a sell order
        accounts::debit_locked(seller, base_asset, fill_quantity);
        accounts::credit_available(buyer, base_asset, fill_quantity);

        // Transfer quote asset (USDC): buyer's locked -> seller's available
        // The buyer had locked their USDC when placing a buy order
        accounts::debit_locked(buyer, quote_asset, quote_amount);
        accounts::credit_available(seller, quote_asset, quote_amount);

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
