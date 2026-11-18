# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-CHAT-006 Timeout, failure, and cancellation
The strategy SHALL race the optimizer call against a 20 second timer. On a timeout or an optimizer error it SHALL log the error and print a notice. It SHALL then print the original prompt as a quote and show one `Use Original` button that calls `promptBooster.runPrompt` with the original prompt. When the cancellation token is set after the call, it SHALL print `Optimization cancelled.` and render nothing else.

#### Scenario: SCN-CHAT-006-1 The optimizer throws
- **WHEN** the optimizer rejects
- **THEN** the stream holds the notice and the original prompt, one `Use Original` button has the argument list `[original]`, and the handler does not throw

#### Scenario: SCN-CHAT-006-2 The optimizer is slow
- **WHEN** the optimizer does not answer in 20 seconds
- **THEN** the stream holds the notice and one `Use Original` button
