# TheAgriDoctor - Copilot Instructions

## CRITICAL RULES (ZERO TOLERANCE)

## Task Completion (Non-Negotiable)

<!-- **ALWAYS end every task with a multi-choice question.** After completing any task (feature, bug fix, refactor, investigation, etc.): -->

## 🔥 MANDATORY - END-OF-SESSION QUESTIONS (ZERO TOLERANCE)

### 🚨 ABSOLUTE RULE - ASK ONE QUESTION AFTER EVERY TASK COMPLETION

**After completing EVERY task, command, or instruction**, Copilot **MUST** ask the user **ONE single follow-up question** using the `vscode_askQuestions` tool. This is **NON-NEGOTIABLE**.

#### Why This Is Required:

- Ensures the user can provide feedback, corrections, or additional context
- Prevents assumptions and misunderstandings
- Keeps the user in control of the development workflow
- Catches issues early before they compound

#### When to Ask:

1. **After completing any task** (code implementation, bug fix, file creation, etc.)
2. **After running any command** (build, test, deploy, migration, etc.)
3. **After completing a set of instructions** (module creation, audit, refactor, etc.)
4. **At the end of every session** before yielding back to the user

#### Question Format (MANDATORY - Use `vscode_askQuestions` Tool):

**Ask exactly ONE question** using the `vscode_askQuestions` tool with:

- **3-5 clickable multi-choice options** relevant to the completed work
- **`allowFreeformInput: true`** so the user can type their own response instead of picking an option
- **A recommended option** when there's a clear best choice

#### Example (MANDATORY format):

```
vscode_askQuestions tool call:
  header: "Next Step"
  question: "Task completed successfully. What would you like to do next?"
  allowFreeformInput: true
  options:
    - Looks good, proceed to next task (recommended)
    - Needs adjustments
    - Run tests and verify
    - Update documentation
```

The user can either **click an option** OR **type their own instruction/feedback** in the free-text field.

#### Rules:

1. **Ask exactly ONE question** after completing any task (NOT multiple questions)
2. **ALWAYS use `vscode_askQuestions` tool** (NOT plain text questions)
3. **ALWAYS set `allowFreeformInput: true`** so user can type custom input
4. **Provide 3-5 clickable options** relevant to the completed work
5. **Include a recommended option** when there's a clear best choice
6. **Question must be specific** to the work just completed (not generic)
7. **Wait for user response** before proceeding to unrelated work
8. NEVER ask multiple questions at once - only ONE question per task completion
9. NEVER skip the question after task completion
10. NEVER assume the user is satisfied without asking
11. NEVER move to a new task without confirming the current one is accepted
12. NEVER ask questions as plain text when the `vscode_askQuestions` tool is available

---

1. Summarize what was done (brief).
2. Present a **multi-choice question** with 3–6 actionable options for what to do next (improvements, related tasks, testing, documentation, etc.).
3. Allow free-form text input alongside the options so the user can type a custom next step.
4. **Never end a task without asking the user what to do next.**
