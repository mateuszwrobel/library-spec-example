---
description: Create a new Architecture Decision Record (ADR) file
---

You are helping to create an Architecture Decision Record (ADR) by first analyzing the decision, then documenting it.

## Workflow

1. **Gather Information**: Ask the user what architectural decision needs to be made
2. **Analyze Options**: Research and compare the available options
3. **Make Recommendation**: Help the user decide based on analysis
4. **Document Decision**: Create the ADR file

## Step 1: Ask About the Decision

First, ask the user:
- What architectural decision needs to be made?
- What options are being considered?
- What are the constraints or requirements?
- What is the use case or problem being solved?

## Step 2: Perform Analysis

Based on the user's input:
- Research each option (use web search if needed for current information)
- Compare options across relevant dimensions (performance, cost, complexity, flexibility, etc.)
- Identify trade-offs
- Consider the specific use case and constraints
- Provide a clear comparison table or structured analysis

## Step 3: Recommendation

Based on the analysis:
- Recommend which option to choose
- Explain the reasoning clearly
- Highlight the key factors that led to this recommendation
- Ask the user if they agree or want to explore further

## Step 4: Create the ADR

Once the decision is made, create the ADR file following these rules:

### File Creation Rules

1. **File Location**: Create ADR files in `docs/adr/` directory
2. **Naming Convention**: Use format `NNNN-title-with-dashes.md` where NNNN is a 4-digit sequential number
3. **File Format**: Use Markdown format

### ADR Structure

Each ADR must include these sections:

#### 1. Title
- Format: `# NNNN. Title of Decision`
- Should be a short noun phrase

#### 2. Status
One of: **Proposed** | **Accepted** | **Deprecated** | **Superseded**

#### 3. Context
- Describe the problem and forces at play
- What constraints exist?
- Keep it factual and neutral

#### 4. Decision
- State the decision clearly: "We will..."
- Use active voice and be specific
- Explain the rationale

#### 5. Consequences

### Positive
- Benefits and advantages

### Negative
- Drawbacks and challenges

### Neutral
- Other impacts

## Template

```markdown
# NNNN. [Title]

**Status**: [Proposed/Accepted/Deprecated/Superseded]

## Context

[Describe the context and problem statement. Include the use case and requirements.]

## Decision

We will [describe the decision].

[Explain why this decision was made, referencing the analysis performed.]

## Consequences

### Positive
- [Positive consequence 1]
- [Positive consequence 2]

### Negative
- [Negative consequence 1]
- [Negative consequence 2]

### Neutral
- [Other impacts or changes]
```

---

Now, please tell me: **What architectural decision needs to be analyzed?**

Provide:
- The decision or problem statement
- The options you're considering
- Any specific requirements or constraints
- The use case or context