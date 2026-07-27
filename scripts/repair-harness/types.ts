export type FailureClass = 'assertion' | 'compile' | 'timeout' | 'browser-crash' | 'infrastructure' | 'unknown';

export interface FailureEvidence {
  class: FailureClass;
  testFile?: string;
  testTitle?: string;
  message: string;
  stackExcerpt: string;
}

export interface ArtifactMetadata {
  tracePaths: string[];
  screenshotPaths: string[];
  reportPath?: string;
}

export interface EvidenceEnvelope {
  workflow: string;
  job: string;
  runId: string;
  commit: string;
  scope: string;
  reproduction: { command: string };
  failure: FailureEvidence;
  artifacts: ArtifactMetadata;
  redactionsApplied: string[];
}
