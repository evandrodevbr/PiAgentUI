import type {
  Message as CompatMessage,
  UserMessage as CompatUserMessage,
  AssistantMessage as CompatAssistantMessage,
  TextPart as CompatTextPart,
  ReasoningPart as CompatReasoningPart,
  ToolPart as CompatToolPart,
  ToolState as CompatToolState,
  FileSource as CompatFileSource,
  FilePart as CompatFilePart,
  AgentPart as CompatAgentPart,
  StepStartPart as CompatStepStartPart,
  StepFinishPart as CompatStepFinishPart,
  SnapshotPart as CompatSnapshotPart,
  PatchPart as CompatPatchPart,
  SubtaskPart as CompatSubtaskPart,
  RetryPart as CompatRetryPart,
  CompactionPart as CompatCompactionPart,
  Part as CompatPart,
  MessageWithParts as CompatMessageWithParts,
} from './compat'

export type MessageSummary = NonNullable<CompatUserMessage['summary']>

export type UserMessage = CompatUserMessage

export type AssistantMessage = CompatAssistantMessage

export type Message = CompatMessage

export type TextPart = CompatTextPart

export type ReasoningPart = CompatReasoningPart

export type ToolState = CompatToolState

export type ToolPart = CompatToolPart

export type FileSource = CompatFileSource

export type FileSourceType = NonNullable<FileSource>['type']

export type FilePart = CompatFilePart

export type AgentPart = CompatAgentPart

export type StepStartPart = CompatStepStartPart

export type StepFinishPart = CompatStepFinishPart

export type SnapshotPart = CompatSnapshotPart

export type PatchPart = CompatPatchPart

export type SubtaskPart = CompatSubtaskPart

export type RetryPart = CompatRetryPart

export type CompactionPart = CompatCompactionPart

export type Part = CompatPart

export type MessageWithParts = CompatMessageWithParts

export type TextPartInput = { text: string }

export type FilePartInput = { filename: string; mime?: string; url?: string }

export type AgentPartInput = { agentID: string }

export type SubtaskPartInput = { subtaskID: string }
