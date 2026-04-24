import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import { useReminders } from "@/hooks/use-reminders";
import { amountToNumber } from "@/ledger/bill";
import type { Bill, Reminder } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { toThousand } from "@/utils/number";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

/**
 * 日历模块 — 在图表分析页面以月曆形式展示每日收支
 */
export function CalendarModule({
    bills,
    range,
    onDateClick,
    selectedCreatorIds,
}: {
    bills: Bill[];
    range: [number, number];
    onDateClick?: (date: dayjs.Dayjs) => void;
    /** 若提供且非空，只顯示 creatorId 在此集合內的提醒；未提供或空集合代表全部 */
    selectedCreatorIds?: Set<string>;
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

    // --- 按日聚合提醒 ---
    // 僅顯示當前使用者被指定為 target 的提醒（非提醒者看不到）
    // 若 selectedCreatorIds 有指定，額外過濾 creatorId 是否在篩選範圍內
    const { reminders } = useReminders();
    const { id: userId } = useUserStore();
    const remindersByDate = useMemo(() => {
        const map = new Map<string, typeof reminders>();
        const hasCreatorFilter =
            selectedCreatorIds && selectedCreatorIds.size > 0;
        for (const r of reminders) {
            if (r.done) continue;
            if (
                !r.targets?.some((id) => String(id) === String(userId))
            )
                continue;
            if (hasCreatorFilter) {
                if (r.creatorId === undefined) continue;
                if (!selectedCreatorIds.has(String(r.creatorId))) continue;
            }
            const key = dayjs(r.time).format("YYYY-MM-DD");
            const list = map.get(key) ?? [];
            list.push(r);
            map.set(key, list);
        }
        // 依重要性 + 時間排序
        for (const list of map.values()) {
            list.sort((a, b) => {
                const pa = a.priority === "important" ? 0 : 1;
                const pb = b.priority === "important" ? 0 : 1;
                if (pa !== pb) return pa - pb;
                return a.time - b.time;
            });
        }
        return map;
    }, [reminders, userId, selectedCreatorIds]);

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
                            const dayReminders =
                                remindersByDate.get(dateKey) ?? [];

                            return (
                                <DayCell
                                    key={dateKey}
                                    day={day}
                                    isCurrentMonth={isCurrentMonth}
                                    isToday={isToday}
                                    data={data}
                                    fmt={fmt}
                                    reminders={dayReminders}
                                    onDateClick={onDateClick}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

function DayCell({
    day,
    isCurrentMonth,
    isToday,
    data,
    fmt,
    reminders,
    onDateClick,
}: {
    day: dayjs.Dayjs;
    isCurrentMonth: boolean;
    isToday: boolean;
    data?: { income: number; expense: number };
    fmt: (v: number) => string;
    reminders: Reminder[];
    onDateClick?: (date: dayjs.Dayjs) => void;
}) {
    const [open, setOpen] = useState(false);
    const hasReminder = reminders.length > 0 && isCurrentMonth;

    const longPressBind = useLongPress({
        disabled: !hasReminder,
        onClick: () => {
            if (isCurrentMonth) onDateClick?.(day);
        },
        onLongPressStart: () => setOpen(true),
    });

    const cellClass = cn(
        "flex flex-col items-center py-1 min-h-[52px] rounded-md text-center transition-colors select-none",
        !isCurrentMonth && "opacity-30",
        isToday && "bg-accent ring-1 ring-accent-foreground/20",
        isCurrentMonth && onDateClick && "cursor-pointer hover:bg-muted",
    );

    const content = (
        <>
            <span
                className={cn(
                    "text-[12px] font-medium leading-none",
                    isToday && "text-accent-foreground font-bold",
                )}
            >
                {day.date()}
            </span>
            {hasReminder && (
                <span
                    className={cn(
                        "mt-0.5 inline-flex items-center gap-0.5 text-[8px] leading-none",
                        reminders.some((r) => r.priority === "important")
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-600 dark:text-amber-400",
                    )}
                >
                    <i
                        className={cn(
                            "size-[9px]",
                            reminders.some((r) => r.priority === "important")
                                ? "icon-[mdi--alert-circle]"
                                : "icon-[mdi--bell]",
                        )}
                    />
                    {reminders.length > 1 ? reminders.length : ""}
                </span>
            )}
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
                </div>
            )}
        </>
    );

    if (!hasReminder) {
        return (
            // biome-ignore lint/a11y/noStaticElementInteractions: calendar day cell
            // biome-ignore lint/a11y/useKeyWithClickEvents: calendar day cell
            <div
                className={cellClass}
                onClick={() => isCurrentMonth && onDateClick?.(day)}
            >
                {content}
            </div>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: calendar day cell */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: calendar day cell */}
                <div
                    className={cellClass}
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    {...(longPressBind ? longPressBind() : {})}
                >
                    {content}
                </div>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="center"
                className="w-auto max-w-[240px] p-2 text-xs"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col gap-1">
                    <div className="text-[11px] text-muted-foreground font-medium">
                        {day.format("YYYY-MM-DD")}
                    </div>
                    {reminders.map((r) => (
                        <div
                            key={r.id}
                            className="flex items-start gap-1.5 leading-tight"
                        >
                            <i
                                className={cn(
                                    "size-3 mt-0.5 flex-shrink-0",
                                    r.priority === "important"
                                        ? "icon-[mdi--alert-circle] text-rose-500"
                                        : "icon-[mdi--bell] text-amber-500",
                                )}
                            />
                            <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">
                                    {r.title}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {dayjs(r.time).format("HH:mm")}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
