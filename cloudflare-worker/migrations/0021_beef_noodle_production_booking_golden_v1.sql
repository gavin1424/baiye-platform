-- Idempotent production booking and golden reset seed scoped to demo_beef_noodle.
INSERT OR IGNORE INTO merchant_booking_settings(merchant_id,enabled,timezone,slot_interval_minutes,minimum_notice_minutes,maximum_advance_days,cancellation_cutoff_minutes,reschedule_cutoff_minutes)
VALUES('demo_beef_noodle',1,'Asia/Taipei',30,0,60,0,0);
INSERT OR IGNORE INTO merchant_booking_routes(route_slug,merchant_id,booking_url) VALUES('beef-noodle-demo','demo_beef_noodle','https://baiyeconnect.com/#/booking/beef-noodle-demo');
INSERT OR REPLACE INTO merchant_booking_services(id,merchant_id,name,description,duration_minutes,price_text,active,sort_order) VALUES
('bn_booking_dine','demo_beef_noodle','試用訂位','體驗既有 Booking Core 建立與管理流程。',60,'示範資料／不進行真實交易',1,10),
('bn_booking_takeaway','demo_beef_noodle','外帶取餐時段','體驗外帶預約流程。',30,'示範資料／不進行真實交易',1,20),
('bn_booking_consult','demo_beef_noodle','系統功能導覽','體驗預約確認、改期與取消。',30,'示範資料／不進行真實交易',1,30);
INSERT OR REPLACE INTO merchant_booking_staff(id,merchant_id,display_name,active,max_concurrent) VALUES
('bn_staff_front','demo_beef_noodle','前台示範人員',1,1),('bn_staff_kitchen','demo_beef_noodle','廚房示範人員',1,1);
INSERT OR IGNORE INTO merchant_booking_service_staff(merchant_id,service_id,staff_id)
SELECT 'demo_beef_noodle',s.id,t.id FROM merchant_booking_services s CROSS JOIN merchant_booking_staff t WHERE s.merchant_id='demo_beef_noodle' AND t.merchant_id='demo_beef_noodle';
INSERT OR IGNORE INTO merchant_booking_hours(id,merchant_id,staff_id,weekday,start_time,end_time,active) VALUES
('bn_hours_front_0','demo_beef_noodle','bn_staff_front',0,'11:00','20:00',1),('bn_hours_front_1','demo_beef_noodle','bn_staff_front',1,'11:00','20:00',1),
('bn_hours_front_2','demo_beef_noodle','bn_staff_front',2,'11:00','20:00',1),('bn_hours_front_3','demo_beef_noodle','bn_staff_front',3,'11:00','20:00',1),
('bn_hours_front_4','demo_beef_noodle','bn_staff_front',4,'11:00','20:00',1),('bn_hours_front_5','demo_beef_noodle','bn_staff_front',5,'11:00','20:00',1),
('bn_hours_front_6','demo_beef_noodle','bn_staff_front',6,'11:00','20:00',1),('bn_hours_kitchen_0','demo_beef_noodle','bn_staff_kitchen',0,'11:00','20:00',1),
('bn_hours_kitchen_1','demo_beef_noodle','bn_staff_kitchen',1,'11:00','20:00',1),('bn_hours_kitchen_2','demo_beef_noodle','bn_staff_kitchen',2,'11:00','20:00',1),
('bn_hours_kitchen_3','demo_beef_noodle','bn_staff_kitchen',3,'11:00','20:00',1),('bn_hours_kitchen_4','demo_beef_noodle','bn_staff_kitchen',4,'11:00','20:00',1),
('bn_hours_kitchen_5','demo_beef_noodle','bn_staff_kitchen',5,'11:00','20:00',1),('bn_hours_kitchen_6','demo_beef_noodle','bn_staff_kitchen',6,'11:00','20:00',1);
