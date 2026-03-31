# Aptos Indexer Events v1 Deprecation Note

## Context

The deployment/integration feature handoff reported that the current indexer path depends on Aptos Indexer GraphQL events v1 patterns that Aptos has deprecated.

## Practical impact in this repo

- The API/indexer can still run, but event fetches may error or degrade as v1 support changes.
- Current behavior logs indexer errors and keeps the service alive, which avoids hard crashes but can cause stale market state.

## Recommended direction

Migrate event ingestion to Aptos Events v2-compatible endpoints/flows and keep transaction/event ordering guarantees when processing mixed event types.
