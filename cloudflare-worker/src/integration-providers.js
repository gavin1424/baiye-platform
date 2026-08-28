export const EASYWALLET_API_MODE="disabled";
export const UBER_DIRECT_MODE="disabled";
const disabled=(name)=>async()=>({ok:false,code:`${name}_DISABLED`,error:"正式 Provider 尚未完成商務與技術驗收。"});
export const easywalletProvider=Object.freeze({createPayment:disabled("EASYWALLET_API"),queryPayment:disabled("EASYWALLET_API"),verifyWebhook:disabled("EASYWALLET_API"),refundPayment:disabled("EASYWALLET_API")});
export const uberDirectProvider=Object.freeze({createDelivery:disabled("UBER_DIRECT"),queryDelivery:disabled("UBER_DIRECT"),cancelDelivery:disabled("UBER_DIRECT")});
