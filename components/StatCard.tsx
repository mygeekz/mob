import React, { useEffect, useRef, useState } from 'react';
import anime from "animejs/lib/anime.es.js";

type StatCardProps = {
  title: string;
  value: number | string;          // می‌تواند عدد خام یا رشتهٔ فرمت‌شده باشد (مثل "۱۲۳٬۴۵۶ تومان")
  icon?: string;                   // کلاس FontAwesome مثل "fa-solid fa-dollar-sign"
  iconBgColor?: string;            // کلاس Tailwind پس‌زمینه آیکون
  iconTextColor?: string;          // کلاس Tailwind رنگ آیکون
  trendText?: string;              // زیرنویس کوچک
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  iconBgColor = 'bg-indigo-100 dark:bg-indigo-900/50',
  iconTextColor = 'text-indigo-600 dark:text-indigo-300',
  trendText
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const numberRef = useRef<HTMLSpanElement | null>(null);
  const [played, setPlayed] = useState(false);

  // نگاشت ارقام فارسی/عربی به انگلیسی
  const normalizeDigits = (s: string) => {
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    const ar = '٠١٢٣٤٥٦٧٨٩';
    return s.replace(/[۰-۹]/g, d => String(fa.indexOf(d)))
            .replace(/[٠-٩]/g, d => String(ar.indexOf(d)));
  };

  // پارس مقدار ورودی (عدد یا رشتهٔ فارسی)
  const parseValue = (v: number | string) => {
    if (typeof v === 'number' && Number.isFinite(v)) return { n: v, suffix: '' };

    const raw = normalizeDigits(String(v ?? '')).trim();

    // جداکننده‌های هزارگان فارسی و انگلیسی را حذف کن
    const cleaned = raw
      .replace(/\u066C/g, '')  // ARABIC THOUSANDS SEPARATOR '٬'
      .replace(/,/g, '')
      .replace(/\s+/g, '');

    // بخش عددی + پسوند (مثل "تومان")
    const numPart = cleaned.replace(/[^0-9.]/g, '');
    const suffixPart = raw.replace(/[0-9\u066C,\s.]+/g, '').trim(); // هر چه غیرعدد باقی بماند

    const n = Number(numPart);
    return { n: Number.isFinite(n) ? n : 0, suffix: suffixPart ? ` ${suffixPart}` : '' };
  };

  const { n: targetNumber, suffix } = parseValue(value);

  useEffect(() => {
    if (!rootRef.current || !numberRef.current) return;

    const run = () => {
      // ورود کارت
      anime.remove(rootRef.current!);
      anime({
        targets: rootRef.current!,
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 420,
        easing: 'easeOutQuad'
      });

      // شمارنده
      const obj = { n: 0 };
      anime.remove(obj as any);
      anime({
        targets: obj,
        n: targetNumber,
        duration: 900,
        easing: 'easeOutCubic',
        update: () => {
          if (numberRef.current) {
            const shown = Math.round(obj.n).toLocaleString('fa-IR');
            numberRef.current.textContent = shown + suffix;
          }
        }
      });
    };

    if (!played) {
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        run();
        setPlayed(true);
        io.disconnect();
      }, { threshold: 0.35 });
      io.observe(rootRef.current);
      return () => io.disconnect();
    } else {
      // اگر مقدار تغییر کرد، فقط شمارنده را دوباره اجرا کن
      const obj = { n: 0 };
      anime({
        targets: obj,
        n: targetNumber,
        duration: 700,
        easing: 'easeOutCubic',
        update: () => {
          if (numberRef.current) {
            const shown = Math.round(obj.n).toLocaleString('fa-IR');
            numberRef.current.textContent = shown + suffix;
          }
        }
      });
    }
  }, [targetNumber, suffix, played]);

  return (
    <div
      ref={rootRef}
      className="kpi-card bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 flex items-center gap-3 opacity-0"
    >
      {icon ? (
        <div className={`h-10 w-10 rounded-xl ${iconBgColor} flex items-center justify-center`}>
          <i className={`${icon} ${iconTextColor} text-lg`} />
        </div>
      ) : null}

      <div className="flex-1 text-right">
        <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
        <div className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-gray-100">
          <span ref={numberRef}>0{suffix}</span>
        </div>
        {trendText ? (
          <div className="text-[11px] text-gray-400 mt-0.5">{trendText}</div>
        ) : null}
      </div>
    </div>
  );
};

export default StatCard;
