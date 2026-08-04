// ─────────────────────────────────────────────────────────────────────────────
// modules/ai -- public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/gemini';
export * from './services/providers';
export type { Finding } from './services/providers/schemas';
export * from './services/aiOrchestration';
export * from './services/projectIntelligence';
export * from './services/onboardingIntelligence';
export { ChatProvider, useChat } from './ChatProvider';
export { default as ChatbotController } from './components/ChatbotController';
export { default as AdvancedBriefingModal } from './components/AdvancedBriefingModal';
export { default as IntelligenceIndexCard } from './components/IntelligenceIndexCard';
export { default as AiOrchestrationPanel } from './components/AiOrchestrationPanel';
