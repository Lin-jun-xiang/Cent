import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { toThousand } from "@/utils/number";
import { Button } from "../ui/button";

/**
 * 日历模块 — 在图表分析页面以月曆形式展示每日收支
 */
export function CalendarModule({
    bills,
    range,
}: {
    bills: Bill[];
    range: [number, number];
}) {
    const t = useIntl();

    // --- 月份导航 ---
    const initialMonth = useMemo(
        () => dayjs(range[1]).startOf("month"),
        [range],
    );
    const [currentMonth, setCurrentMonth] = useState(initialMonth);

    // --- 按日聚合 ---
    const dailyData = useMemo(() => {
        const map = new Map<string, { income: number; expense: number }>();
        for (const bill of bills) {
            const dateKey = dayjs(bill.time).format("YYYY-MM-DD");
            const entry = map.get(dateKey) ?? { income: 0, expense: 0 };
            const amount = amountToNumber(bill.amount);
            if (bill.type === "income") {
                entry.income += amount;
            } else {
                entry.expense += amount;
            }
            map.set(dateKey, entry);
        }
        return map;
    }, [bills]);

    // --- 月份日曆格子 ---
    const calendarDays = useMemo(() => {
        const monthStart = currentMonth.startOf("month");
        const monthEnd = currentMonth.endOf("month");
        const calStart = monthStart.startOf("week");
        const calEnd = monthEnd.endOf("week");
        const days: dayjs.Dayjs[] = [];
        let cur = calStart;
        while (cur.isSameOrBefore(calEnd, "day")) {
            days.push(cur);
            cur = cur.add(1, "day");
        }
        return days;
    }, [currentMonth]);

    const weeks = useMemo(() => {
        const result: dayjs.Dayjs[][] = [];
        for (let i = 0; i < calendarDays.length; i += 7) {
            result.push(calendarDays.slice(i, i + 7));
        }
        return result;
    }, [calendarDays]);

    // --- 星期標頭 ---
    const weekdayLabels = useMemo(() => {
        return calendarDays.slice(0, 7).map((d) => {
            const name = d.toDate().toLocaleDateString(undefined, {
                weekday: "narrow",
            });
            return name;
        });
    }, [calendarDays]);

    // --- 月份汇总 ---
    const monthSummary = useMemo(() => {
        let income = 0;
        let expense = 0;
        for (const [dateKey, entry] of dailyData) {
            if (dayjs(dateKey).isSame(currentMonth, "month")) {
                income += entry.income;
                expense += entry.expense;
            }
        }
        return { income, expense, net: income - expense };
    }, [dailyData, currentMonth]);

    const fmt = (v: number) => {
        const s = toThousand(Math.abs(v), 0, 1);
        return s.length > 5 ? toThousand(Math.abs(v), 0, 0) : s;
    };
    const today = dayjs();

    // --- 年月选择器 ---
    const [showPicker, setShowPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(currentMonth.year());
    const pickerRef = useRef<HTMLDivElement>(null);

    const openPicker = useCallback(() => {
        setPickerYear(currentMonth.year());
        setShowPicker(true);
    }, [currentMonth]);

    const selectMonth = useCallback((year: number, month: number) => {
        setCurrentMonth(dayjs().year(year).month(month).startOf("month"));
        setShowPicker(false);
    }, []);

    // 帳單年份範圍
    const yearRange = useMemo(() => {
        const startYear = dayjs(range[0]).year();
        const endYear = dayjs(range[1]).year();
        const years: number[] = [];
        for (let y = endYear; y >= startYear; y--) {
            years.push(y);
        }
        // 確保至少有前後一年可選
        if (!years.includes(endYear + 1)) years.unshift(endYear + 1);
        if (!years.includes(startYear - 1)) years.push(startYear - 1);
        return years;
    }, [range]);

    return (
        <div className="rounded-md border p-3 w-full flex flex-col gap-3">
            {/* 标题 */}
            <h2 className="font-medium text-lg text-center">
                {t("calendar-view")}
            </h2>

            {/* 月份导航 */}
            <div className="flex items-center justify-between relative">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                        setCurrentMonth((m) => m.subtract(1, "month"))
                    }
                >
                    <i className="icon-[mdi--chevron-left] size-5" />
                </Button>
                <button
                    type="button"
                    onClick={openPicker}
                    className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
                >
                    <span className="font-semibold text-base flex items-center gap-1">
                        {currentMonth.format("YYYY / MM")}
                        <i className="icon-[mdi--chevron-down] size-4 opacity-50" />
                    </span>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="text-semantic-income">
                            +{toThousand(monthSummary.income, 0, 2)}
                        </span>
                        <span className="text-semantic-expense">
                            -{toThousand(monthSummary.expense, 0, 2)}
                        </span>
                        <span
                            className={
                                monthSummary.net >= 0
                                    ? "text-semantic-income"
                                    : "text-semantic-expense"
                            }
                        >
                            {monthSummary.net >= 0 ? "+" : "-"}
                            {toThousand(Math.abs(monthSummary.net), 0, 2)}
                        </span>
                    </div>
                </button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentMonth((m) => m.add(1, "month"))}
                >
                    <i className="icon-[mdi--chevron-right] size-5" />
                </Button>

                {/* 年月选择下拉面板 */}
                {showPicker && (
                    <>
                        {/* 遮罩 */}
                        {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowPicker(false)}
                            onKeyDown={() => {}}
                        />
                        <div
                            ref={pickerRef}
                            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-popover border rounded-xl shadow-lg p-3 w-[280px] flex flex-col gap-2"
                        >
                            {/* 年份选择 */}
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPickerYear((y) => y - 1)}
                                >
                                    <i className="icon-[mdi--chevron-left] size-4" />
                                </Button>
                                <span className="font-semibold text-sm">
                                    {pickerYear}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPickerYear((y) => y + 1)}
                                >
                                    <i className="icon-[mdi--chevron-right] size-4" />
                                </Button>
                            </div>
                            {/* 月份网格 */}
                            <div className="grid grid-cols-4 gap-1.5">
                                {Array.from({ length: 12 }, (_, i) => {
                                    const isSelected =
                                        pickerYear === currentMonth.year() &&
                                        i === currentMonth.month();
                                    const isCurrent =
                                        pickerYear === today.year() &&
                                        i === today.month();
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() =>
                                                selectMonth(pickerYear, i)
                                            }
                                            className={cn(
                                                "py-2 rounded-lg text-sm transition-colors",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : isCurrent
                                                      ? "bg-accent text-accent-foreground font-medium"
                                                      : "hover:bg-muted text-foreground",
                                            )}
                                        >
                                            {i + 1}月
                                        </button>
                                    );
                                })}
                            </div>
                            {/* 快速跳到年份 */}
                            <div className="flex gap-1 flex-wrap justify-center pt-1 border-t">
                                {yearRange.map((y) => (
                                    <button
                                        key={y}
                                        type="button"
                                        onClick={() => setPickerYear(y)}
                                        className={cn(
                                            "text-xs px-2 py-0.5 rounded-md transition-colors",
                                            y === pickerYear
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:bg-muted",
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* 日曆 */}
            <div className="w-full">
                {/* 星期標頭 */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {weekdayLabels.map((label, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: static 7 items
                            key={i}
                            className="text-center text-[11px] text-muted-foreground font-medium py-1"
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {/* 日期格子 */}
                {weeks.map((week) => (
                    <div
                        key={week[0]?.format("YYYY-MM-DD")}
                        className="grid grid-cols-7 gap-0.5"
                    >
                        {week.map((day) => {
                            const isCurrentMonth = day.isSame(
                                currentMonth,
                                "month",
                            );
                            const isToday = day.isSame(today, "day");
                            const dateKey = day.format("YYYY-MM-DD");
                            const data = dailyData.get(dateKey);
                            const net = data
                                ? data.income - data.expense
                                : undefined;

                            return (
                                <div
                                    key={dateKey}
                                    className={cn(
                                        "flex flex-col items-center py-1 min-h-[52px] rounded-md text-center transition-colors",
                                        !isCurrentMonth && "opacity-30",
                                        isToday &&
                                            "bg-accent ring-1 ring-accent-foreground/20",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "text-[12px] font-medium leading-none",
                                            isToday &&
                                                "text-accent-foreground font-bold",
                                        )}
                                    >
                                        {day.date()}
                                    </span>
                                    {data && isCurrentMonth && (
                                        <div className="flex flex-col items-center mt-0.5 gap-px">
                                            {data.expense > 0 && (
                                                <span className="text-[8px] leading-tight text-semantic-expense">
                                                    -{fmt(data.expense)}
                                                </span>
                                            )}
                                            {data.income > 0 && (
                                                <span className="text-[8px] leading-tight text-semantic-income">
                                                    +{fmt(data.income)}
                                                </span>
                                            )}
                                            {data.income > 0 &&
                                                data.expense > 0 &&
                                                net !== undefined && (
                                                    <span
                                                        className={cn(
                                                            "text-[7px] leading-tight font-medium",
                                                            net >= 0
                                                                ? "text-semantic-income"
                                                                : "text-semantic-expense",
                                                        )}
                                                    >
                                                        {net >= 0 ? "+" : "-"}
                                                        {fmt(net)}
                                                    </span>
                                                )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
