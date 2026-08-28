const uid=(p)=>`${p}_${crypto.randomUUID()}`;
const clean=(v,n=160)=>String(v??"").trim().slice(0,n);
const transitions={
 confirm:["created","pending_customer_payment","pending_merchant_confirmation"],
 cancel:["created","pending_customer_payment","pending_merchant_confirmation"],
 refund:["confirmed"],
};

export async function transitionPaymentIntent(db,{merchantId,intentId,action,actorId,reference,idempotencyKey}){
 if(!transitions[action]||!/^[\w.:-]{8,100}$/.test(idempotencyKey||""))return{ok:false,status:400,error:"Invalid payment transition request"};
 const replay=await db.prepare("SELECT result_json FROM merchant_integration_operations WHERE merchant_id=? AND scope=? AND idempotency_key=?").bind(merchantId,`payment:${action}`,idempotencyKey).first();
 if(replay)return{...JSON.parse(replay.result_json),replayed:true};
 const row=await db.prepare(`SELECT i.*,o.membership_id,o.payment_status,p.coupon_id,p.coupon_discount_minor,c.status coupon_status,k.refund_policy
 FROM merchant_order_payment_intents i JOIN merchant_food_orders o ON o.id=i.order_id
 JOIN merchant_order_pricing p ON p.order_id=o.id
 LEFT JOIN merchant_member_coupons c ON c.id=p.coupon_id
 LEFT JOIN merchant_coupon_campaigns k ON k.id=c.campaign_id
 WHERE i.id=? AND i.merchant_id=?`).bind(intentId,merchantId).first();
 if(!row)return{ok:false,status:404,error:"Payment intent not found"};
 if(!transitions[action].includes(row.status))return{ok:false,status:409,error:`Cannot ${action} from ${row.status}`};
 const next=action==="confirm"?"confirmed":action==="refund"?"refunded":"cancelled";
 const orderPayment=action==="confirm"?"paid":action==="refund"?"refunded":"unpaid";
 const result={ok:true,intent_id:row.id,status:next,order_payment_status:orderPayment,coupon_action:"none"};
 const statements=[
  db.prepare(`UPDATE merchant_order_payment_intents SET status=?,merchant_confirmation_reference=?,confirmed_at=CASE WHEN ?='confirm' THEN CURRENT_TIMESTAMP ELSE confirmed_at END,cancelled_at=CASE WHEN ?='cancel' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,refunded_at=CASE WHEN ?='refund' THEN CURRENT_TIMESTAMP ELSE refunded_at END,confirmed_by=CASE WHEN ?='confirm' THEN ? ELSE confirmed_by END,cancelled_by=CASE WHEN ?='cancel' THEN ? ELSE cancelled_by END,refunded_by=CASE WHEN ?='refund' THEN ? ELSE refunded_by END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status=?`).bind(next,clean(reference)||null,action,action,action,action,actorId,action,actorId,action,actorId,row.id,merchantId,row.status),
  db.prepare("UPDATE merchant_food_orders SET payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(orderPayment,row.order_id,merchantId),
 ];
 if(row.coupon_id&&action==="confirm"){
  result.coupon_action="redeemed";
  statements.push(
   db.prepare("UPDATE merchant_member_coupons SET status='redeemed',redeemed_order_id=?,redeemed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status='reserved' AND reserved_order_id=?").bind(row.order_id,row.coupon_id,merchantId,row.order_id),
   db.prepare("INSERT OR IGNORE INTO merchant_coupon_redemptions(id,merchant_id,coupon_id,membership_id,order_id,action,amount_minor,idempotency_key,actor_type,actor_id) VALUES(?,?,?,?,?,'redeemed',?,?,'admin',?)").bind(uid("coupon_event"),merchantId,row.coupon_id,row.membership_id,row.order_id,Number(row.coupon_discount_minor),`payment-confirm:${row.id}`,actorId)
  );
 }
 if(row.coupon_id&&action==="cancel"&&row.coupon_status==="reserved"){
  result.coupon_action="released";
  statements.push(
   db.prepare("UPDATE merchant_member_coupons SET status='active',reserved_order_id=NULL,reserved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status='reserved' AND reserved_order_id=?").bind(row.coupon_id,merchantId,row.order_id),
   db.prepare("INSERT OR IGNORE INTO merchant_coupon_redemptions(id,merchant_id,coupon_id,membership_id,order_id,action,amount_minor,idempotency_key,actor_type,actor_id) VALUES(?,?,?,?,?,'released',?,?,'admin',?)").bind(uid("coupon_event"),merchantId,row.coupon_id,row.membership_id,row.order_id,Number(row.coupon_discount_minor),`payment-cancel:${row.id}`,actorId)
  );
 }
 if(row.coupon_id&&action==="refund"){
  if(row.refund_policy==="restore_coupon"){
   result.coupon_action="restored";
   statements.push(db.prepare("UPDATE merchant_member_coupons SET status='active',redeemed_order_id=NULL,redeemed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status='redeemed'").bind(row.coupon_id,merchantId));
  }else if(row.refund_policy==="manual_review"){result.coupon_action="manual_review"}
  else result.coupon_action="not_restored";
  statements.push(db.prepare("INSERT INTO merchant_coupon_redemptions(id,merchant_id,coupon_id,membership_id,order_id,action,amount_minor,idempotency_key,actor_type,actor_id) VALUES(?,?,?,?,?,'revoked',0,?,'admin',?)").bind(uid("coupon_event"),merchantId,row.coupon_id,row.membership_id,row.order_id,`payment-refund:${row.id}`,actorId));
 }
 statements.push(
  db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,action,resource_type,resource_id,metadata) VALUES(?,?,'admin',?,?, 'payment_intent',?,?)").bind(uid("audit"),merchantId,actorId,`payment_intent_${next}`,row.id,JSON.stringify({order_id:row.order_id,coupon_action:result.coupon_action,reference:clean(reference)||null})),
  db.prepare("INSERT INTO merchant_integration_operations(id,merchant_id,scope,idempotency_key,resource_id,result_json) VALUES(?,?,?,?,?,?)").bind(uid("operation"),merchantId,`payment:${action}`,idempotencyKey,row.id,JSON.stringify(result))
 );
 await db.batch(statements);
 return result;
}
