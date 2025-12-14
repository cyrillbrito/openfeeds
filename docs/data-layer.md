# Data Layer: Local-First Architecture

## Ideology

Amazing apps feel **instant, real-time, blazingly fast** - no loaders on every page. This is the goal.

## Why TanStack DB

TanStack DB is **progressive** - creates abstraction/division layer that evolves over TanStack Query. You can:
- Attach to automated sync engines (ElectricSQL, etc.)
- Use regular HTTP
- Switch between approaches without changing app code

Provides:
- **Local-first availability** - data available immediately, syncs in background
- **Abstraction layer** - sync engine hidden behind TanStack interface

## Progressive Path

**Today**: HTTP data loading and mutations (standard approach)

**Tomorrow**: As library matures and sync engines improve (SQLite integration, etc.), progressively migrate to:
- Real-time sync engines
- Instant local reads
- Background writes
- Zero network latency in UI

Abstraction layer ensures seamless evolution from HTTP → sync engine without rewriting app code.

## Current Reality

Library is young - struggling with some aspects (articles collection, massive datasets). But as a path forward, it's the best way to achieve the target UX.

## Stack

- **TanStack DB**: Data layer interface / abstraction
- **Underlying sync engine**: Pluggable (ElectricSQL, HTTP, etc.)
- **Server**: Traditional backend (sync target)

The architecture may feel premature, but it's the only path to the UX we want.
