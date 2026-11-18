# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-BOOST-002 Replace in place
`ManualModeStrategy.execute` SHALL get a model from `getModel`, call `optimize` under a cancellable progress notice, and replace the given range with the result through one workspace edit. Empty text SHALL give the warning `No text to optimize`. No model SHALL end the run with no edit. A missing document URI or range SHALL log an error and make no edit. The call SHALL add no workspace context, references, or MCP tools.

Refs: REQ-ENH-001, REQ-CFG-002

#### Scenario: SCN-BOOST-002-1 No model
- **WHEN** the model provider returns no model
- **THEN** the optimizer is not called and the document does not change

#### Scenario: SCN-BOOST-002-2 The mode check
- **WHEN** the settings file of the user still holds `promptBooster.operationMode: "realtime"`
- **THEN** `Boost This Prompt` runs as before, because no mode check exists
