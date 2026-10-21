# 04-06 live check: result (user approved 2026-10-21)

- Golden set, prompt rule v2 (group by brand): 10/10 passed (MUST and MUST-NOT 0).
- Real data, 120-item batches, verified in the browser by the orchestrator with the user logged in:
  - 227 descriptions → 2 batches, both 200, 196 cards; send dialog listed only descriptions and supplier names (no RFC/UUID/amounts found).
  - Multi-member card quality ≈ 82% (9/11). Doubtful: «Leche deslactosada» mixes Member's Mark with LacDel; «Google Ads» includes «Cancelación Prepago».
  - Accepted «Topochico mineral» and «Sprite 600 ml» (3 members each, settings v3); after reload the caption went 227 → 221.
  - Second sample (221): 2 calls, both 200, 194 cards.
  - Wrong-key injection: done by the user, approved.
- Open quality item: «JAMON ZWAN» (Walmart) and «JAMON ZWAN VIRGINIA» (Productos de Consumo Z) land in separate cards in both samples (D-32), most likely because they fall in different supplier batches; also manchego and deslactosada pairs split. Re-check after Plan 04-15 (cross-batch merge).
