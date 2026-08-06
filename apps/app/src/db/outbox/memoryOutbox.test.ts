import { runOutboxContract } from './outboxSuite';
import { InMemoryOutbox } from './memoryOutbox';

// A fixed clock keeps enqueue timestamps deterministic; the suite drives all
// time-dependent behaviour (backoff windows) through explicit ISO arguments.
runOutboxContract('InMemoryOutbox', () => new InMemoryOutbox(() => '2026-08-06T00:00:00.000Z'));
