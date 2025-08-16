// فایل: server/smsService.ts (کد کامل و نهایی)

import fetch from 'node-fetch';

interface MeliPayamakResponse {
  Value: string;
  RetStatus: number;
  StrRetStatus: string;
}

interface SmsResult {
  success: boolean;
  message: string;
  details?: MeliPayamakResponse | { error: string };
}

export const sendPatternSms = async (
  to: string,
  bodyId: number,
  text: string,
  username: string,
  password: string
): Promise<SmsResult> => {

  const url = 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber';

  const payload = {
    to,
    bodyId,
    text,
    username,
    password
  };

  const controller = new AbortController();
  // **مهم: یک محدودیت زمانی ۱۰ ثانیه‌ای اضافه می‌کنیم**
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal // **مهم: اتصال سیگنال تایم‌اوت به درخواست**
    });

    clearTimeout(timeoutId); // **مهم: در صورت دریافت پاسخ، تایم‌اوت را لغو می‌کنیم**

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ Message: `خطای شبکه با کد ${response.status}` }));
      console.error(`MelliPayamak API request failed with status ${response.status}. Body:`, JSON.stringify(errorBody));
      throw new Error(`خطا در ارتباط با پنل پیامک: ${errorBody.Message || response.statusText}`);
    }

    const result: MeliPayamakResponse = await response.json();

    if (result.RetStatus === 1) {
      console.log('SMS sent successfully via MeliPayamak:', result.Value);
      return { success: true, message: 'پیامک با موفقیت ارسال شد.', details: result };
    } else {
      console.error('MeliPayamak returned an error:', result.StrRetStatus);
      throw new Error(`خطا از پنل پیامک: ${result.StrRetStatus}`);
    }

  } catch (error: any) {
    clearTimeout(timeoutId); // **مهم: در صورت بروز هرگونه خطا، تایم‌اوت را لغو می‌کنیم**
    
    if (error.name === 'AbortError') {
        console.error('SMS request timed out.');
        return { success: false, message: 'ارتباط با سرویس پیامک بیش از حد طول کشید (Timeout). لطفاً مجدداً تلاش کنید.' };
    }
    
    console.error('Error in sendPatternSms:', error);
    return { success: false, message: error.message || 'خطای پیش‌بینی نشده در سرویس پیامک.' };
  }
};