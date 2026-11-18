# Product

## Platform

web (desktop browser, keyboard)

## Users
Friends who want a quick race together: one person shares a link and everyone is racing within a minute. No accounts.

## Product Purpose
An online 3D cross-country horse race. Success is a close, chaotic, readable race where clearing obstacles well (timing jumps, picking lines, spending stamina) beats just holding forward.

## Positioning
Original setting and characters (the Drifter, four horse coats, a badlands canyon course). The only borrowed idea is a long-distance horse race across wild terrain.

## Operating Context
Desktop browser, keyboard (WASD/arrows, Space, Shift). Up to 8 riders per room. A Node server hosts rooms. Solo practice works offline, with the best time stored in localStorage under `dustline-best`.

## Capabilities and Constraints
- Vite + three.js client, `ws` server (see CLAUDE.md).
- Client-authoritative movement, relayed at 20 Hz. Fine for friendly races, not for ranked play.
- One course. Coats and poncho colours are cosmetic.

## Product Principles
- Join fast: a name and a link, nothing else.
- Every obstacle is readable at full gallop.
- Falling is a time penalty, never a dead end.
- Keep the dependency list short.
