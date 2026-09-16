# Phase 5 串接與驗收

## 目前狀態
已部署至 JEWELFIND（`tsnqoybajiosufwngfsc`，Southeast Asia/Singapore），並完成前端到 Edge Function 的真實端到端驗收。Phase 1～4 的推薦、換批、問答、商品資料／圖片沒有修改。未建立登入流程，未進入 Phase 6，未輸出或更新 ZIP。
目前工作專案：C:\Users\linda\Documents\Codex\2026-09-10\new-chat-2。

## 資料表與儲存
- customers：id、name、phone（unique）、line_id、region、created_at、updated_at。
- match_requests：所有指定欄位，另加 submission_key（unique）、submission_fingerprint、is_new_customer，以支援可靠重試。
- viewing_rate_limits：只供伺服器使用的請求頻率限制輔助表，不保存原始 IP。
- reference-photos：私人圖片 bucket，JPG／PNG、最大 5 MB。reference_photo_url 保存穩定的 authenticated URL，並非公開連結；管理端未來需經授權產生短效 signed URL 才能讀取。

## 寫入流程
1. 前端把聯絡資料、五題答案、選中商品 ID、看貨時間及可選照片傳至 submit-viewing Edge Function。
2. 伺服器檢查輸入、圖片大小與檔頭、合法選項，並由 server catalog 核對商品名称。任意商品名稱不會被信任。
3. 手機移除空白／連字號，+886／00886 格式統一為 09 開頭十碼。
4. SQL RPC 以手機交易鎖及 unique constraint 保證去重。新手機建立 customer；舊手機更新姓名與地區，有填 LINE 才更新，空白不抹除既有 LINE。
5. 同一交易建立新 match_request，保存五題、商品及看貨資料。viewing_region 沿用現有表單所在地區；實際地點後續人工確認。
6. 正常每次新送出建立一筆 request。同一筆 HTTP 重試沿用 submission_key，回傳原收據，不重複新增。前端確認成功後，下次送出產生新 key。
7. 只有資料庫確認成功才導向成功頁，依 isNewCustomer 顯示指定新／舊客戶文字。

## 安全與目前邊界
- service role key 只由 Edge Function 的 SUPABASE_SERVICE_ROLE_KEY 取得，絕不放入 VITE_* 或前端。
- customers、match_requests 與輔助表啟用 RLS；anon／authenticated 無資料表讀寫權限；寫入 RPC 只授權 service_role。
- Edge Function 已啟用 JWT 檢查，前端使用 publishable/anon key 呼叫；這是受驗證、限流的寫入入口。CORS 不是身分驗證。
- 每來源摘要每分鐘 10 次、全站每分鐘 120 次，另有每手機每分鐘最多 5 筆需求。正式流量需評估限額與機器人防護。
- 不提供「憑手機查客戶／歷史需求」接口。新舊客戶提示依需求會透露該手機是否已建檔；現階段沒有 OTP 驗證，所以手機只是去重 key，無法證明填表人擁有該手機。
- 「專屬帳號」目前指 Customer 聯絡檔案，不是 Supabase Auth 登入身分。未來 OTP／magic link 驗證成功後才能授權讀寫帳戶歷史。
- 照片上傳與 PostgreSQL 不是同一交易。失敗時可能留下私人孤立照片；不在不確定的資料庫錯誤後直接刪除，以免誤刪已成功提交的照片。維運應透過 Storage API 清理超過保留期且沒有 match_request 引用的物件。
- 收據與表單草稿仍是本次瀏覽的記憶體資料；重新整理不會刪除資料庫中的需求，也不應因此再次送出。

## 部署紀錄
1. 透過 Supabase Dashboard SQL Editor 套用 migration，建立 customers、match_requests、viewing_rate_limits、RLS、RPC 及私人 reference-photos bucket。
2. 透過 Dashboard Edge Function Editor 部署 `submit-viewing`，並更新 CORS headers 以支援 Authorization／apikey。
3. 在 Edge Function Secrets 設定 `ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173`；Supabase 預設 `SUPABASE_URL` 與 service secrets 保留在伺服器端。
4. 根目錄 `.env.local` 設定公開 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。service role／secret key 沒有放入前端。

## 真實驗收結果（2026-09-11）
新客戶：
1. 從首頁完成五題，以「直接找尋」進入推薦，再選晨曦單鑽戒。
2. 測試手機：`0987654321`；第一次填「Phase5測試新客戶」、LINE `phase5_line`、台北市、2030-05-20 14:00。
3. 第一次成功頁顯示「需求已送出」及「已為你建立專屬帳號」。
4. 查詢結果：`customer_count = 1`、`request_count = 1`。
舊客戶：
1. 再建立需求，沿用 `0987654321`，改填「Phase5測試舊客戶」、LINE 留空、台中市、2030-06-20 15:00。
2. 第二次成功頁顯示「已加入你的最新看貨需求」。查詢結果：`customer_count = 1`、`request_count = 2`；Customer 同一 ID，姓名／地區更新，既有 LINE 保留。
其他：
- LINE 留空再次提交，原 LINE 不被清除。
- 第五題「直接找尋」：reference_photo_url 為 null；上傳 JPG／PNG：有私人圖片 URL，未授權使用者不能讀取。
- 斷網／後端錯誤不應出現成功頁。保留表單重試同筆請求不可多一筆資料。
- 匿名金鑰不能直接查 customers、match_requests 或直接執行寫入 RPC。

## 檔案變更
修改：src/services/viewingService.ts、src/pages/ViewingPage.tsx、.env.example。
新增：.gitignore、supabase/config.toml、supabase/migrations/202609110001_phase5.sql、supabase/functions/submit-viewing/index.ts、supabase/functions/_shared/validation.ts、supabase/functions/_shared/catalog.ts、supabase/tests/phase5.sql、tests/phase5.test.mjs、tests/viewing-client.test.mjs、本說明 PHASE5.md。
work/deno-check.d.ts、work/tsconfig.edge-check.json 僅為本機型別檢查暫存。

## 已完成檢查
node --test tests/*.test.mjs：8/8 通過（含 mock HTTP transport，不等於真實資料庫驗收）。
前端 TypeScript、Edge Function 本機型別檢查及 Vite production build 通過。
ESLint 無錯誤；既有 Provider／hook 檔案有兩則 Fast Refresh 警告。
已完成：Supabase migration 實際套用、Edge Function 雲端部署、RLS／私人 bucket 設定、前端到後端新／舊客戶端到端驗收。尚未進入 Phase 6。
