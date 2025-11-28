# DEPRECATED - offsec-ui

**Status**: Archived (2025-11-28)

This directory contains the original Rubedo design prototype that has been fully migrated to `/apps/ui`.

## What Was Migrated

The following design elements were extracted and integrated into the main UI:

- **Rubedo Design System**: Tailwind configuration with colors, typography, animations
- **Component Styling**: Visual design patterns for cards, stats, status indicators
- **Layout Structure**: Shell layout, grid system, panel components

## Where It Lives Now

All functionality now lives in `/apps/ui/src/components/rubedo/`:

- `RubedoShell.tsx` - Main layout wrapper
- `Card.tsx`, `StatCard.tsx` - Card components
- `ThreatItem.tsx`, `ActionItem.tsx`, `ReceiptItem.tsx` - List items
- `GuardianCard.tsx` - Guardian status cards
- `DefenseMode.tsx`, `ConnectionStatus.tsx` - Status indicators
- `EmptyState.tsx`, `Loading.tsx` - Utility components

## Do Not Use

This directory is archived for reference only. All active development should occur in `/apps/ui`.

If you need to reference the original implementation, the code is preserved here but should not be run or modified.

## Safe to Delete

This archive can be safely deleted once you've confirmed the migration is complete and working.

```bash
rm -rf /home/sovereign/offsec-shield/apps/offsec-ui-archive
```
