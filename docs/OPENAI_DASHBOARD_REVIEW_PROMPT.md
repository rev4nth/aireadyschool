# Prompt for OpenAI — GapFinder dashboard review

Copy below into ChatGPT / OpenAI if you want extra UI critique after the fix.

---

You are a senior product designer reviewing GapFinder AI’s student dashboard.

## Bug that was reported
When the navbar subject selector is set to **Data Structures**, the dashboard showed **Biology** revision tasks (photosynthesis / Calvin cycle). The gap summary correctly said Data Structures, but upcoming revision leaked another subject’s plan.

## Expected behavior
Every dashboard widget must be strictly scoped to the selected subject:
- mastery / weak-medium-strong counts
- upcoming revision tasks
- latest gap summary
- quizzes completed / plan progress

No cross-subject leakage.

## Ask
1. Confirm the scoping rule is correct for a multi-subject study app.
2. Suggest a clean, professional student dashboard layout (not generic AI SaaS fluff).
3. Keep diagnosis as the center: mastery, weak topics, next revision actions.
4. Avoid motivational filler copy, purple gradients, and crowded metric cards.
5. Give a short checklist for judging “subject isolation” during a demo.
