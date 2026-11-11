# Two-second bomb fuse verification

- Shared fuse: 2,000 ms in dungeon rules, consumed by simulation, Phaser visuals and server damage budgets.
- Visuals: two steady pulses with an accelerating warning during the final 500 ms.
- Existing save intervals and chest-claim limits are unchanged. A longer fuse does not inherently reduce scheduled database writes; server damage cycles now follow the slower timing.
- Tests: 47 existing dungeon/session tests passed, plus the new exact planted-fuse/damage-boundary test (48 total). Server boundary assertions retain the existing in-flight allowance.
- Browser: `/test-ui` at 1440×889 and 844×390; eight observed bombs resolved at their deadlines, two mock sync batches accepted all reported keys and partial chest damage read back. No page errors. Screenshots inspected; preview build OK.
- Connected-wallet `/play` and real persistent-save readback remain unverified without an active Xaman wallet session. Mock verification does not establish production persistence.