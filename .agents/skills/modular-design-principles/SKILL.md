# Modular Design Principles

Core rules for designing and building software. Referenced by planner and reviewer agents.
Applies to all languages (Rust, C#, Python, JavaScript) and all frameworks.

## The One Rule

Build small programs. Compose them.

## Principles

### 1. One behavior, one module

Every module hides one behavior — one concern that changes for one reason. If a module contains two behaviors that change independently, they belong in separate modules.

**The test:** Can you change or rewrite this module's behavior without touching unrelated behavior elsewhere? If not — the module either mixes concerns or is entangled with another module.

**Extraction trigger:** When new functionality emerges inside an existing module and it has its own reason to change — extract it into its own module immediately. Don't wait. The longer crossing logic stays in one place, the harder it is to separate.

### 2. Optimize for deletion

Write code expecting it will be deleted. When a module's model no longer fits new requirements — delete and rewrite it. Do not twist a bad model to accommodate new features.

**Signal:** If adding a feature requires working around the module's existing structure — adding flags, special cases, or avoiding the core model — that's the trigger. The model no longer fits. Delete, rebuild with a model that accommodates both old and new requirements.

Rewriting a small module is always cheaper than patching a wrong model. The patches accumulate; a rewrite is clean.

### 3. Module = hidden design decision

A module exists because it hides a specific design decision. The boundary is defined by what it hides, not what it exposes.

**Test:** If you cannot name what design decision a module hides, it should not be a separate module.

**Anti-test:** If removing the module boundary wouldn't change anything — there is no real boundary. Merge it.

### 4. Interface = contract

An interface is a contract to deliver a specific service. Contracts include:
- What it accepts
- What it returns
- How it fails
- What guarantees it provides

Clients depend on the contract, never on the implementation.

### 5. Minimize coupling (assumptions, not just imports)

Coupling is the assumptions modules make about each other:
- Shared data formats (JSON schemas, DB tables)
- Implicit threading or concurrency models
- Version conventions
- Two modules that share a database table are coupled even if they never call each other
- A module that holds a concrete type from another module is coupled to that module's implementation, even if the type is public. **Depend on contracts (traits/interfaces), not concrete types.**

### 6. Maximize cohesion

A module is "one thing." All its parts belong together. Splitting it would cause pain.
This is not "single responsibility" — it is "this belongs together as a whole."

**Anti-pattern:** If a module is just a passthrough to another module — merge them. No real boundary exists.

### 7. Each module chooses its own internal architecture

DDD, CRUD, functional, procedural — each module picks what fits. The boundary contract is what matters, not internal uniformity across the system.

**Do:** Use DDD for a complex domain module. Use a flat CRUD handler for a simple settings module.
**Don't:** Force DDD ceremony on a 50-line CRUD module. Force CRUD on a complex domain.

### 8. One owner per lifecycle

Every piece of mutable state or shared resource must have exactly one module that owns its lifecycle (creation, mutation, destruction). Other modules receive it as a dependency or get copies.

**Anti-pattern:** A callback, connection, or shared object that multiple modules create, configure, or swap independently. If two modules can both set the active callback, neither owns it. Add a composition root — one module that owns the lifecycle and exposes registration/unregistration to others.

**Test:** For each piece of shared/mutable data, can you point to exactly one module that creates it and decides when it changes? If not, add a composition root.

### 9. Don't forecast — build for rewrite

Do not add abstractions for hypothetical future requirements. Build the simplest thing that works now. Keep it small enough to throw away. When requirements change, rewrite the affected module.

### 10. Boundaries exist at three levels

- **Development time** — source code, files, packages
- **Deployment time** — artifacts, containers, what you ship
- **Runtime** — processes, memory isolation

These are independent. A source code module does not have to map 1:1 to a runtime process.

### 11. Technical debt is fine when modules hide one behavior

Debt lets you ship fast. When a module hides one behavior, debt is cheap to pay off: delete the module, rewrite it clean. The cost of rewriting grows with the number of unrelated behaviors tangled together, not with line count.

## Behavioral Cohesion Guidelines

| Measure | Guideline |
|---------|-----------|
| Reasons to change | Exactly one — if two parts change for different reasons, split |
| Public API surface | As small as possible — fewer contracts = clearer behavior |
| Dependencies on other modules | As few as possible |
| Rewritability | Can delete and rebuild this concern without rebuilding unrelated concerns |

## Quick Example

**BAD:** `UserService` handles authentication, profile management, notification preferences, and avatar upload. Four behaviors, four independent reasons to change. Changing auth logic risks breaking notifications. Can't rewrite one concern without touching the others.

**GOOD:** Four modules — `AuthModule` (hides auth strategy), `ProfileModule` (hides profile storage), `NotificationPrefsModule` (hides notification config), `AvatarModule` (hides image processing). Each has one reason to change. Each is deletable and rewritable independently. Each picks its own internal style.