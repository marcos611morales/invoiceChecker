# API Coverage — DeepSeek

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Capability surface from the DeepSeek API docs read in 04-RESEARCH.md (2026-10-19). The deterministic detector returned `detected: false` on the plan text (vocabulary miss); this phase does call an external API, so the matrix is recorded here.

| capability | decision | reason |
|---|---|---|
| chat-completions (POST /chat/completions, non-streaming) | INTEGRATE | |
| json-output-mode (response_format json_object) | INTEGRATE | |
| thinking-mode-toggle (thinking.type disabled) | INTEGRATE | |
| sampling-temperature | INTEGRATE | |
| max-tokens | INTEGRATE | |
| usage-reporting (usage, reasoning_tokens) | INTEGRATE | |
| error-codes (400, 401, 402, 422, 429, 500, 503) | INTEGRATE | |
| rate-limit-retry-after (429 handling) | INTEGRATE | |
| finish-reason-handling | INTEGRATE | |
| streaming (stream true, SSE) | OPT-OUT | not needed: no chat UI or streaming requirement (.claude/CLAUDE.md DeepSeek client); RESEARCH keeps it only as a fallback if idle disconnects appear at the live check |
| reasoning-output (reasoning_content, thinking enabled) | OPT-OUT | explicitly out of scope: thinking is disabled for grouping and classification (D-29, .claude/CLAUDE.md, RESEARCH Pitfall 1) |
| function-calling (tools, tool_choice) | OPT-OUT | not needed: the answer is ids and names validated by zod, no tool use (RESEARCH Pattern 1) |
| multi-round-conversation | OPT-OUT | not needed: every batch is one stateless request; resume recomputes the free set (RESEARCH Pattern 3) |
| chat-prefix-completion (beta) | OPT-OUT | not needed: JSON mode with an example covers structured output (RESEARCH DeepSeek facts) |
| fim-completion (beta, /completions) | OPT-OUT | explicitly out of scope: code fill-in-the-middle has no use in invoice grouping |
| context-caching | OPT-OUT | not needed: applied automatically on DeepSeek's side; cost is not a design constraint (RESEARCH token estimate) |
| list-models (GET /models) | OPT-OUT | not needed: the model is fixed by DEEPSEEK_MODEL with default deepseek-flash (CONTEXT Claude's Discretion) |
| user-balance (GET /user/balance) | OPT-OUT | not needed: a 402 already maps to the «La cuenta de DeepSeek no tiene saldo» message; no balance display is required (UI-SPEC run failures) |
| logprobs (logprobs, top_logprobs) | OPT-OUT | not needed: no confidence scores are shown; the human review queue is the quality gate (LLM-04) |
| stop-sequences | OPT-OUT | not needed: JSON mode plus max_tokens and finish_reason bound the answer |
| alternate-model (deepseek-v4-pro) | OPT-OUT | not needed yet: deepseek-flash is the default; DEEPSEEK_MODEL can switch without code changes |
| anthropic-compatible-endpoint | OPT-OUT | explicitly out of scope: the OpenAI-compatible endpoint with plain fetch was chosen (D-29) |
