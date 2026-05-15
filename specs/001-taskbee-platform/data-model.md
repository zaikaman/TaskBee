# Data Model: Redesign Marketplace UI

*Note: This feature is purely a visual UI redesign.*

## Entities

No database entity or schema changes are requested or required. The existing payload provided by loadMarketplaceTasks matches the UI demands for attributes such as Status, Reward (Payment), Location, and Employer metadata.

## Interface Contracts

No backend API contracts will be changed. Frontend props might shift slightly for UI rendering (e.g. passing explicit employerStats objects), but they derive off of existing data.
