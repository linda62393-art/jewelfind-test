# Excel 商品同步

需求：Python 3.10 以上。僅使用標準函式庫，不需 Excel 安裝或付費服務。
原始 Excel 保留在專案外，存檔後再執行。工具不修改 Excel、Git 或 Supabase。

這台 Windows 電腦可在專案資料夾使用：
```
.\scripts\sync-products.ps1 -ExcelPath "Excel完整路徑.xlsx"
.\scripts\sync-products.ps1 -ExcelPath "Excel完整路徑.xlsx" -Apply
```
第一行只比對；第二行才套用本機商品。此入口會優先使用已安裝的 bundled Python。

先預覽差異（不更改商品）：
```
python scripts/sync-products.py "完整路徑/missdiamondjewelry 商品總表.xlsx"
```
確認後套用到本機：
```
python scripts/sync-products.py "完整路徑/missdiamondjewelry 商品總表.xlsx" --apply
```
報告預設為 `outputs/product-sync/latest.json`，可使用 `--report outputs/product-sync/另存報告.json`。
首次報告另存為 `outputs/product-sync/first-sync.json`。

報告的新增、更新、未變更、待處理為互斥分類；待處理會優先分類，包含缺名稱、
缺主圖、缺價格或尚未確認的 SKU 對照。它們保留在 snapshot，但不加入推薦和新需求白名單。
「售出／歸還」有完整資料時仍可同步，僅不提供新看貨需求。庫存空白為未知，不是零。
缺其他角度照直接使用現有主圖，不阻擋。未出現在本次 Excel 的既有 SKU 保留。
重複 SKU、缺標頭、錯誤數值與有效欄位公式錯誤會中止，不覆寫商品。

商品的結構化規格由母表欄位產生；描述取自 Excel。原始特色、敘述、規格另保留於
來源 snapshot。含金重的描述行不顯示；已發現 18KR 材質與描述 14K 矛盾時，
暫不顯示該段描述，待母表修正後再同步。其餘原文不自行改寫或補猜規格。
金重以原始值留在 `catalog/snapshot.json` 的來源欄位，未加入前端輸出，暫不顯示。
圖片從 public/assets/missdiamond 取用；不讀 Excel 主圖公式。只公開白名單欄位，
不匯出成本、通路售價、寄售店家及備註。不要提交 Excel 或 outputs 報告。

`catalog/sync-config.json` 管理舊 ID 對照、分類、風格標籤及已確認的圖片例外。
12 個單一 SKU 對應保留舊 ID；既有風格標籤另存，新增 SKU 不自動猜風格。
混圖的 n-01/n-02/b-01 暫不對應或繼續推薦，歷史 Match Request 不回寫。
要解除 pendingMappings，必須先確認 SKU 與舊 ID；不得僅刪除原因掩蓋歧義。

每次 --apply 同時產生：
- catalog/snapshot.json（可重跑的來源快照）
- src/configs/products.ts（前端商品）
- supabase/functions/_shared/catalog.ts（可接受新看貨需求的商品 ID／名稱）

檢查：`python -m unittest discover -s tests -p "*_test.py"`、`pnpm test`、`pnpm lint`、`pnpm build:pages`。
本機預覽：`pnpm preview --mode pages --port 4174`。

注意：目前只有本機檔案更新，正式 Edge Function 仍是舊商品白名單；不要用本機新品
向正式後端送驗收需求。未來經批准發布時，需先部署同版 Edge Function 商品目錄，
再发布前端並驗收。若要只在本機測試提交，請使用獨立的本機 Supabase 環境。
同步不會自動 Commit、Push、部署或變更既有 Customer／Match Request。
