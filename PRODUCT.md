# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Retro and nostalgia fans playing at a desktop keyboard, in short sessions, chasing a personal best. No account, instant start.

## Product Purpose
A small browser Snake game. Success is a fast, reliable, satisfying run that makes players want one more try and beat their best score.

## Positioning
The rules are the classic ones; the difference is exceptional feel and polish (game feel, motion, presentation) rather than new mechanics.

## Operating Context
Played in a desktop browser with arrow keys or WASD. The best score persists in localStorage under `snake-best`.

## Capabilities and Constraints
- Vite + vanilla JS, no framework, no tests, dependency-free apart from Vite (see CLAUDE.md).
- 20x20 grid on a 400x400 canvas; constants (`SIZE`, `CELLS`, `TICK_MS`) live at the top of `src/main.js`.
- Desktop keyboard input only (arrows/WASD); touch support is not in scope.
- Current features: score, persisted best, start/game-over overlay with "press any key" restart.
- Undecided: new modes or mechanics (none planned).

## Brand Commitments
None confirmed beyond the name "Snake". The existing green-on-black look is incumbent, not declared binding.

## Evidence on Hand
No testimonials, leaderboards, or external assets exist; do not fabricate any.

## Product Principles
- Feel over features: polish the classic loop instead of adding mechanics.
- Instant start: no menus, accounts, or friction between page load and play.
- Keyboard-first and legible at a glance while moving fast.
- Stay dependency-free and small.
