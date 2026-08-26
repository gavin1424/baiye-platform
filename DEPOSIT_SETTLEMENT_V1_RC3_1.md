# 訂金代收與月結對帳 RC3.1 Staging Gate

狀態：`RC3_1_CODE_COMPLETE`（須在 CI 通過後才可建立隔離 Staging）

## 資料完整性 Gate

- 計算版本統一為 `settlement-v3`。
- Offset Ledger 僅能 INSERT；UPDATE／DELETE 由 D1 trigger 拒絕。
- Profile 抵付目標不得低於 posted Ledger 餘額，存在 Ledger 時不得直接改為一次付清。
- Ledger 的 settlement／adjustment reference 必須屬於相同 merchant。
- 退款 Adjustment 具 pending → approved/rejected 的一次性正式覆核流程與冪等操作。
- 同商家非 void 對帳期間不得重疊；歷史倒帳回傳 `HISTORICAL_CORRECTION_REQUIRED`。
- Carry Forward 僅承接較早且已鎖定／付款的期間；未來 Ledger 不回流歷史月份。
- Settlement V1 僅接受 TWD，公開金額輸入使用嚴格十進位轉換。
- 同一 Statement／Operation Type 僅允許一筆 processing operation。
- Legacy Finance 本月統計改採 Asia/Taipei 的 UTC 半開區間。

## Production Lock

本階段不得套用 Production migration、部署 Production Worker／Pages、使用 Production D1／R2／Secrets，或啟用任何正式商家 Settlement Profile。

