import { useGameStore } from './gameStore';
import { applyGameStoreFixes } from './applyGameStoreFixes';

applyGameStoreFixes(useGameStore);

// Deterministic browser regression tests can opt into the store API without
// exposing it during normal play.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa')) {
  (window as any).__HKOS_QA_STORE__ = useGameStore;
}

export { useGameStore };
