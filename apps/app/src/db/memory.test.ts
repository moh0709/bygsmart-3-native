import { runRepositoryContract } from './contractSuite';
import { InMemoryRepository } from './memory';

// The in-memory runtime must satisfy the repository contract (layer 4). Native
// SQLite and wasm-SQLite-over-OPFS runtimes will run this SAME suite.
runRepositoryContract('in-memory', () => new InMemoryRepository());
