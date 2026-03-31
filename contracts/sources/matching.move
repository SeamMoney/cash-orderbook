/// Matching engine for the Cash Orderbook.
/// Implements price-time priority matching of taker orders against the resting book.
///
/// For buy taker: matches against asks (ascending price) — lowest ask first.
/// For sell taker: matches against bids (descending price via inverted keys) — highest bid first.
///
/// Self-trade prevention: if taker.owner == maker.owner, the maker order is skipped.
///
/// Returns a vector of Trade structs representing each fill.
module cash_orderbook::matching {
    use std::vector;
    use cash_orderbook::types::{Self, Order, OrderKey};
    use cash_orderbook::market;

    // ========== Trade Struct ==========

    /// Represents a single fill between a taker and a maker order.
    struct Trade has copy, drop, store {
        /// Taker order ID
        taker_order_id: u64,
        /// Maker order ID
        maker_order_id: u64,
        /// Fill price (maker's price)
        price: u64,
        /// Fill quantity in base asset units
        quantity: u64,
        /// Taker is buyer (true) or seller (false)
        taker_is_bid: bool,
        /// Buyer address
        buyer: address,
        /// Seller address
        seller: address,
        /// Market pair ID
        pair_id: u64,
    }

    // ========== Trade Accessors ==========

    public fun trade_taker_order_id(trade: &Trade): u64 { trade.taker_order_id }
    public fun trade_maker_order_id(trade: &Trade): u64 { trade.maker_order_id }
    public fun trade_price(trade: &Trade): u64 { trade.price }
    public fun trade_quantity(trade: &Trade): u64 { trade.quantity }
    public fun trade_taker_is_bid(trade: &Trade): bool { trade.taker_is_bid }
    public fun trade_buyer(trade: &Trade): address { trade.buyer }
    public fun trade_seller(trade: &Trade): address { trade.seller }
    public fun trade_pair_id(trade: &Trade): u64 { trade.pair_id }

    // ========== Matching Engine ==========

    /// Match a taker order against the opposing side of the book.
    ///
    /// For buy taker: iterates asks from lowest price up.
    ///   - Match condition: taker.price >= maker.price (for limit orders)
    ///   - For market buy orders, taker.price can be set very high or match unconditionally
    ///
    /// For sell taker: iterates bids from highest price down.
    ///   - Match condition: taker.price <= maker.price (for limit orders)
    ///   - For market sell orders, taker.price can be set to 0 or match unconditionally
    ///
    /// Self-trade prevention: if taker.owner == maker.owner, skip that maker.
    ///
    /// Returns: vector<Trade> of all fills executed.
    /// The taker order's remaining_quantity is updated in-place.
    public(friend) fun match_order(
        taker_order: &mut Order,
        is_market_order: bool,
    ): vector<Trade> {
        let trades = vector::empty<Trade>();
        let taker_is_bid = types::order_is_bid(taker_order);
        let taker_owner = types::order_owner(taker_order);
        let pair_id = types::order_pair_id(taker_order);

        if (taker_is_bid) {
            // Buy taker: match against asks (ascending price)
            match_buy_taker(taker_order, is_market_order, taker_owner, pair_id, &mut trades);
        } else {
            // Sell taker: match against bids (descending price via inverted keys)
            match_sell_taker(taker_order, is_market_order, taker_owner, pair_id, &mut trades);
        };

        trades
    }

    /// Match buy taker against asks.
    /// Iterates from lowest ask price upward.
    fun match_buy_taker(
        taker_order: &mut Order,
        is_market_order: bool,
        taker_owner: address,
        pair_id: u64,
        trades: &mut vector<Trade>,
    ) {
        let taker_price = types::order_price(taker_order);

        // Collect skipped orders (self-trade) to re-insert after matching
        let skipped_keys = vector::empty<OrderKey>();
        let skipped_orders = vector::empty<Order>();

        while (types::order_remaining_quantity(taker_order) > 0 && !market::asks_is_empty()) {
            // Peek at the best ask
            let (ask_price, _ask_qty, ask_owner) = market::peek_best_ask();

            // Price check: for limit buy, taker.price >= maker.price
            // For market buy, always match (no price limit)
            if (!is_market_order && taker_price < ask_price) {
                break // No more matching asks at this price level
            };

            // Pop the best ask from the book
            let (maker_key, maker_order) = market::pop_front_ask();

            // Self-trade prevention: skip if same owner
            if (ask_owner == taker_owner) {
                vector::push_back(&mut skipped_keys, maker_key);
                vector::push_back(&mut skipped_orders, maker_order);
                continue
            };

            // Calculate fill quantity
            let taker_remaining = types::order_remaining_quantity(taker_order);
            let maker_remaining = types::order_remaining_quantity(&maker_order);
            let fill_qty = if (taker_remaining < maker_remaining) {
                taker_remaining
            } else {
                maker_remaining
            };

            // Update taker remaining
            types::set_remaining_quantity(taker_order, taker_remaining - fill_qty);

            // Create trade record
            let trade = Trade {
                taker_order_id: types::order_id(taker_order),
                maker_order_id: types::order_id(&maker_order),
                price: types::order_price(&maker_order), // Fill at maker's price
                quantity: fill_qty,
                taker_is_bid: true,
                buyer: taker_owner,
                seller: types::order_owner(&maker_order),
                pair_id,
            };
            vector::push_back(trades, trade);

            // If maker has remaining quantity, update and re-insert
            if (maker_remaining > fill_qty) {
                types::set_remaining_quantity(&mut maker_order, maker_remaining - fill_qty);
                market::reinsert_ask(maker_key, maker_order);
            };
            // If maker is fully filled, it stays removed from the book (already popped)
        };

        // Re-insert any skipped orders (self-trade prevention)
        let i = 0;
        let len = vector::length(&skipped_keys);
        while (i < len) {
            let key = *vector::borrow(&skipped_keys, i);
            let order = *vector::borrow(&skipped_orders, i);
            market::reinsert_ask(key, order);
            i = i + 1;
        };
    }

    /// Match sell taker against bids.
    /// Iterates from highest bid price downward.
    /// Bids use inverted price keys, so begin iterator = highest real price.
    fun match_sell_taker(
        taker_order: &mut Order,
        is_market_order: bool,
        taker_owner: address,
        pair_id: u64,
        trades: &mut vector<Trade>,
    ) {
        let taker_price = types::order_price(taker_order);

        // Collect skipped orders (self-trade) to re-insert after matching
        let skipped_keys = vector::empty<OrderKey>();
        let skipped_orders = vector::empty<Order>();

        while (types::order_remaining_quantity(taker_order) > 0 && !market::bids_is_empty()) {
            // Peek at the best bid (highest price due to inverted keys)
            let (bid_price, _bid_qty, bid_owner) = market::peek_best_bid();

            // Price check: for limit sell, taker.price <= maker.price
            // For market sell, always match (no price limit)
            if (!is_market_order && taker_price > bid_price) {
                break // No more matching bids
            };

            // Pop the best bid from the book
            let (maker_key, maker_order) = market::pop_front_bid();

            // Self-trade prevention: skip if same owner
            if (bid_owner == taker_owner) {
                vector::push_back(&mut skipped_keys, maker_key);
                vector::push_back(&mut skipped_orders, maker_order);
                continue
            };

            // Calculate fill quantity
            let taker_remaining = types::order_remaining_quantity(taker_order);
            let maker_remaining = types::order_remaining_quantity(&maker_order);
            let fill_qty = if (taker_remaining < maker_remaining) {
                taker_remaining
            } else {
                maker_remaining
            };

            // Update taker remaining
            types::set_remaining_quantity(taker_order, taker_remaining - fill_qty);

            // Create trade record
            let trade = Trade {
                taker_order_id: types::order_id(taker_order),
                maker_order_id: types::order_id(&maker_order),
                price: types::order_price(&maker_order), // Fill at maker's price
                quantity: fill_qty,
                taker_is_bid: false,
                buyer: types::order_owner(&maker_order), // Maker is the buyer (bid)
                seller: taker_owner,
                pair_id,
            };
            vector::push_back(trades, trade);

            // If maker has remaining quantity, update and re-insert
            if (maker_remaining > fill_qty) {
                let new_remaining = maker_remaining - fill_qty;
                types::set_remaining_quantity(&mut maker_order, new_remaining);
                // Proportionally reduce locked_quote for partial fills on bids.
                // This ensures cancel returns the exact remaining locked amount.
                let old_locked = types::order_locked_quote(&maker_order);
                if (old_locked > 0) {
                    let new_locked = ((old_locked as u128) * (new_remaining as u128) / (maker_remaining as u128) as u64);
                    types::set_locked_quote(&mut maker_order, new_locked);
                };
                market::reinsert_bid(maker_key, maker_order);
            };
            // If maker is fully filled, it stays removed from the book
        };

        // Re-insert any skipped orders (self-trade prevention)
        let i = 0;
        let len = vector::length(&skipped_keys);
        while (i < len) {
            let key = *vector::borrow(&skipped_keys, i);
            let order = *vector::borrow(&skipped_orders, i);
            market::reinsert_bid(key, order);
            i = i + 1;
        };
    }

    // ========== Friend Declarations ==========
    friend cash_orderbook::order_placement;
    friend cash_orderbook::settlement;
}
