import dayjs from "dayjs";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import CloudLoopIcon from "@/assets/icons/cloud-loop.svg?react";
import AnimatedNumber from "@/components/animated-number";
import { showBillInfo } from "@/components/bill-info";
import { showBookGuide } from "@/components/book/util";
import BudgetCard from "@/components/budget/card";
import { HintTooltip } from "@/components/hint";
import { PaginationIndicator } from "@/components/indicator";
import Ledger from "@/components/ledger";
import BillItem from "@/components/ledger/item";
import Loading from "@/components/loading";
import Money from "@/components/money";
import { showReminderEdit } from "@/components/reminder";
import { CalendarModule } from "@/components/stat/calendar-module";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import WidgetPreview from "@/components/widget/preview";
import { useBudget } from "@/hooks/use-budget";
import { useCreators } from "@/hooks/use-creator";
import { useReminders } from "@/hooks/use-reminders";
import { useSnap } from "@/hooks/use-snap";
import { useWidget } from "@/hooks/use-widget";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { denseDate } from "@/utils/time";

export default function Page() {
    const t = useIntl();

    const { bills, loading, sync } = useLedgerStore();
    const currentBook = useBookStore(
        useShallow((state) => {
            const { currentBookId, books } = state;
            return books.find((b) => b.id === currentBookId);
        }),
    );
    const showAssets = usePreferenceStore(
        useShallow((state) => state.showAssetsInLedger),
    );
    const { id: userId } = useUserStore();

    // --- Creator filter ---
    const creators = useCreators();
    const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(
        () => new Set(),
    );
    const isAllCreatorsSelected = selectedCreatorIds.size === 0;

    const syncIconClassName =
        sync === "wait"
            ? "icon-[mdi--cloud-minus-outline]"
            : sync === "syncing"
              ? "icon-[line-md--cloud-alt-print-loop]"
              : sync === "success"
                ? "icon-[mdi--cloud-check-outline]"
                : "icon-[mdi--cloud-remove-outline] text-red-600";
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [expandedView, setExpandedView] = useState(false);
    const ledgerRef = useRef<any>(null);

    // --- Day navigation ---
    const goToPrevDay = useCallback(() => {
        setCurrentDate((d) => d.subtract(1, "day"));
    }, []);
    const goToNextDay = useCallback(() => {
        setCurrentDate((d) => {
            const next = d.add(1, "day");
            return next.isAfter(dayjs(), "day") ? d : next;
        });
    }, []);
    const goToToday = useCallback(() => {
        setCurrentDate(dayjs());
    }, []); // --- Touch swipe support for day switching ---
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const swipeLocked = useRef(false);
    const billListRef = useRef<HTMLDivElement>(null);
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        swipeLocked.current = false;
    }, []);
    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null)
                return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            const dy = e.changedTouches[0].clientY - touchStartY.current;
            // Only trigger horizontal swipe if horizontal movement dominates
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx > 0) goToPrevDay();
                else goToNextDay();
            }
            touchStartX.current = null;
            touchStartY.current = null;
        },
        [goToPrevDay, goToNextDay],
    );

    const currentDateBills = useMemo(() => {
        const timeBills = filterOrderedBillListByTimeRange(bills, [
            currentDate.startOf("day"),
            currentDate.endOf("day"),
        ]);
        if (isAllCreatorsSelected) return timeBills;
        return timeBills.filter((b) =>
            selectedCreatorIds.has(String(b.creatorId)),
        );
    }, [bills, currentDate, selectedCreatorIds, isAllCreatorsSelected]);

    const { todayExpense, todayIncome } = useMemo(() => {
        let expense = 0;
        let income = 0;
        for (const b of currentDateBills) {
            if (b.type === "expense") expense += b.amount;
            else income += b.amount;
        }
        return {
            todayExpense: amountToNumber(expense),
            todayIncome: amountToNumber(income),
        };
    }, [currentDateBills]);

    const balance = todayIncome - todayExpense;

    const { budgets: allBudgets } = useBudget();
    const budgets = allBudgets.filter((b) => {
        return b.joiners.includes(userId) && b.start < Date.now();
    });

    const { homeWidgets } = useWidget();

    const budgetContainer = useRef<HTMLDivElement>(null);
    const widgetContainer = useRef<HTMLDivElement>(null);
    const { count: budgetCount, index: curBudgetIndex } = useSnap(
        budgetContainer,
        0,
    );
    useSnap(widgetContainer, 0);

    const allLoaded = useRef(false);
    useLayoutEffect(() => {
        if (!allLoaded.current && budgets.length > 0) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, [budgets.length]); // Load all bills when viewing older dates or expanding
    useEffect(() => {
        if (
            !allLoaded.current &&
            (!currentDate.isSame(dayjs(), "day") || expandedView)
        ) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, [currentDate, expandedView]);

    const onDateClick = useCallback(
        (date: dayjs.Dayjs) => {
            setCurrentDate(date);
            const index = bills.findIndex((bill) => {
                const billDate = dayjs.unix(bill.time / 1000);
                return billDate.isSame(date, "day");
            });
            if (index >= 0) {
                ledgerRef.current?.scrollToIndex(index);
            }
        },
        [bills],
    );

    const onItemShow = useCallback((index: number) => {
        if (!allLoaded.current && index >= 120) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, []);

    const isToday = currentDate.isSame(dayjs(), "day");

    // --- Creator-filtered bills + range for CalendarModule ---
    const creatorFilteredBills = useMemo(() => {
        if (isAllCreatorsSelected) return bills;
        return bills.filter((b) => selectedCreatorIds.has(String(b.creatorId)));
    }, [bills, selectedCreatorIds, isAllCreatorsSelected]);

    const calendarRange = useMemo<[number, number]>(() => {
        const start = bills[bills.length - 1]?.time ?? Date.now();
        const end = bills[0]?.time ?? Date.now();
        return [start, end];
    }, [bills]);

    // --- Reminder quick add ---
    const { reminders, add: addReminder, update: updateReminder, remove: removeReminder } =
        useReminders();
    const goAddReminder = useCallback(async () => {
        try {
            const d = new Date(currentDate.valueOf());
            d.setHours(12, 0, 0, 0);
            const reminder = await showReminderEdit({
                title: "",
                time: d.getTime(),
                // 空 targets 讓表單使用預設（全部）
                targets: [],
            } as any);
            if (reminder) {
                await addReminder(reminder as any);
            }
        } catch {
            /* cancelled */
        }
    }, [currentDate, addReminder]);

    // --- 當前日期 + 當前用戶相關的提醒 ---
    // 1. 僅顯示當前使用者被指定為 target 的提醒（非提醒者看不到）
    // 2. 若使用者有啟用建立者過濾，提醒的 creatorId 必須在已選中建立者內
    const currentDateReminders = useMemo(() => {
        return reminders
            .filter((r) => dayjs(r.time).isSame(currentDate, "day"))
            .filter((r) =>
                r.targets?.some((id) => String(id) === String(userId)),
            )
            .filter((r) => {
                if (isAllCreatorsSelected) return true;
                if (r.creatorId === undefined) return false;
                return selectedCreatorIds.has(String(r.creatorId));
            })
            .sort((a, b) => {
                // 重要性排序：important 優先，然後按時間
                const pa = a.priority === "important" ? 0 : 1;
                const pb = b.priority === "important" ? 0 : 1;
                if (pa !== pb) return pa - pb;
                return a.time - b.time;
            });
    }, [
        reminders,
        currentDate,
        userId,
        isAllCreatorsSelected,
        selectedCreatorIds,
    ]);

    const editReminder = useCallback(
        async (id: string) => {
            const r = reminders.find((x) => x.id === id);
            if (!r) return;
            try {
                const result = (await showReminderEdit(r as any)) as any;
                if (result) {
                    await updateReminder(id, result);
                }
            } catch {
                /* cancelled */
            }
        },
        [reminders, updateReminder],
    );

    return (
        <div className="w-full h-full p-2 flex flex-col overflow-hidden page-show">
            <div className="flex flex-wrap flex-col w-full gap-2">
                {/* ── Date navigation header ── */}
                <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-1">
                        {currentBook && (
                            <button
                                type="button"
                                className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity mr-2"
                                onClick={() => showBookGuide()}
                            >
                                <i className="icon-[mdi--book] size-4"></i>
                                {currentBook.name}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <HintTooltip
                            persistKey={"cloudSyncHintShows"}
                            content={
                                "等待云同步完成后，其他设备即可获取最新的账单数据"
                            }
                        >
                            <button
                                type="button"
                                className="cursor-pointer flex items-center p-1"
                                onClick={() => StorageAPI.toSync()}
                            >
                                {sync === "syncing" ? (
                                    <CloudLoopIcon width={18} height={18} />
                                ) : (
                                    <i
                                        className={cn(
                                            syncIconClassName,
                                            "size-[18px]",
                                        )}
                                    ></i>
                                )}
                            </button>
                        </HintTooltip>
                        <button
                            className="cursor-pointer flex items-center p-1"
                            type="button"
                            onClick={() => {
                                if (!loading)
                                    useLedgerStore.getState().initCurrentBook();
                            }}
                        >
                            <div
                                className={cn(
                                    "opacity-0",
                                    loading && "opacity-100",
                                )}
                            >
                                <Loading className="[&_i]:size-[18px]" />
                            </div>
                        </button>
                    </div>
                </div>
                {/* ── Day selector with left/right arrows + calendar ── */}
                <div className="flex items-center justify-center gap-3 px-2">
                    <button
                        type="button"
                        onClick={goToPrevDay}
                        className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
                    >
                        <i className="icon-[mdi--chevron-left] size-6"></i>
                    </button>
                    <button
                        type="button"
                        onClick={goToToday}
                        className="text-base font-semibold px-4 py-1 rounded-full hover:bg-muted transition-colors cursor-pointer min-w-[120px] text-center"
                    >
                        {isToday
                            ? (t("today") ?? "今日")
                            : denseDate(currentDate)}
                    </button>
                    <button
                        type="button"
                        onClick={goToNextDay}
                        className={cn(
                            "p-2 rounded-full hover:bg-muted transition-colors cursor-pointer",
                            isToday && "opacity-30 pointer-events-none",
                        )}
                    >
                        <i className="icon-[mdi--chevron-right] size-6"></i>
                    </button>{" "}
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
                            >
                                <i className="icon-[mdi--calendar-month-outline] size-5"></i>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[min(95vw,400px)] p-0"
                            align="center"
                        >
                            <CalendarModule
                                bills={creatorFilteredBills}
                                range={calendarRange}
                                selectedCreatorIds={selectedCreatorIds}
                                onDateClick={(date) => {
                                    setCurrentDate(date);
                                    setCalendarOpen(false);
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                    <button
                        type="button"
                        onClick={() => setExpandedView((v) => !v)}
                        className={cn(
                            "p-2 rounded-full hover:bg-muted transition-colors cursor-pointer",
                            expandedView && "bg-muted",
                        )}
                        title={expandedView ? "收合" : "展開全部"}
                    >
                        <i
                            className={cn(
                                "size-5",
                                expandedView
                                    ? "icon-[mdi--view-day-outline]"
                                    : "icon-[mdi--view-list-outline]",
                            )}
                        ></i>
                    </button>
                </div>
                {/* ── Expense / Income summary blocks ── */}
                <div className="flex gap-3 px-2">
                    <div className="flex-1 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white p-4 shadow-md shadow-rose-500/20">
                        <div className="text-sm opacity-90 mb-1">
                            {t("expense")}
                        </div>
                        <div className="text-2xl font-bold">
                            <Money value={todayExpense} />
                        </div>
                    </div>
                    <div className="flex-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 shadow-md shadow-emerald-500/20">
                        <div className="text-sm opacity-90 mb-1">
                            {t("income")}
                        </div>
                        <div className="text-2xl font-bold">
                            <Money value={todayIncome} />
                        </div>
                    </div>
                </div>
                {/* ── Balance ── */}
                <div className="text-center text-sm text-muted-foreground">
                    {t("Balance")}:{" "}
                    <AnimatedNumber
                        value={balance}
                        className="font-semibold inline-flex"
                    />
                </div>{" "}
                {/* ── Creator filter ── */}
                {creators.length > 1 && (
                    <div className="w-full px-2 flex gap-1.5 flex-wrap items-center">
                        <span className="text-xs text-muted-foreground mr-0.5">
                            <i className="icon-[mdi--account-filter-outline] size-4 align-middle" />
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedCreatorIds(new Set())}
                            className={cn(
                                "text-xs px-2.5 py-1 rounded-full transition-colors border",
                                isAllCreatorsSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
                            )}
                        >
                            {t("all")}
                        </button>
                        {creators.map((c) => {
                            const selected = selectedCreatorIds.has(
                                String(c.id),
                            );
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCreatorIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(String(c.id))) {
                                                next.delete(String(c.id));
                                            } else {
                                                next.add(String(c.id));
                                            }
                                            return next;
                                        });
                                    }}
                                    className={cn(
                                        "text-xs px-2.5 py-1 rounded-full transition-colors border",
                                        selected
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
                                    )}
                                >
                                    {c.name}
                                </button>
                            );
                        })}
                    </div>
                )}
                {homeWidgets.length > 0 && (
                    <div className="w-full flex flex-col gap-1">
                        <div
                            ref={widgetContainer}
                            className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
                        >
                            {homeWidgets.map((widget) => (
                                <div
                                    key={widget.id}
                                    className="flex-shrink-0 snap-start w-full min-h-[100px] border border-border/60 rounded-xl overflow-hidden shadow-sm"
                                >
                                    <WidgetPreview widget={widget} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="w-full flex flex-col gap-1">
                    <div
                        ref={budgetContainer}
                        className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
                    >
                        {budgets.map((budget) => (
                            <BudgetCard
                                className="flex-shrink-0 snap-start"
                                key={budget.id}
                                budget={budget}
                            />
                        ))}
                    </div>
                </div>
                {budgetCount > 1 && (
                    <div className="flex justify-center">
                        <PaginationIndicator
                            count={budgetCount}
                            current={curBudgetIndex}
                        />
                    </div>
                )}
            </div>{" "}
            {/* ── Transaction list ── */}
            <div
                ref={billListRef}
                className="flex-1 translate-0 pb-[10px] overflow-hidden"
                onTouchStart={expandedView ? undefined : onTouchStart}
                onTouchEnd={expandedView ? undefined : onTouchEnd}
            >
                <div className="w-full h-full overflow-y-auto flex flex-col">
                    {" "}
                    {/* ── Reminders section (on top) ── */}
                    {!expandedView && (
                        <div className="pt-2 pb-2 flex flex-col gap-2 flex-shrink-0">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="font-semibold text-base flex items-center gap-1.5">
                                    <i className="icon-[mdi--bell-outline] size-4 text-amber-500" />
                                    {t("reminders") ?? "提醒"}
                                </h3>
                                <button
                                    type="button"
                                    onClick={goAddReminder}
                                    className="text-xs text-muted-foreground flex items-center gap-0.5 px-2 py-1 rounded-full hover:bg-muted transition-colors cursor-pointer"
                                >
                                    <i className="icon-[mdi--plus] size-4" />
                                    {t("reminder-add") ?? "新增提醒"}
                                </button>
                            </div>
                            {currentDateReminders.length > 0 ? (
                                <div className="flex flex-col divide-y">
                                    {currentDateReminders.map((r) => {
                                        const done = !!r.done;
                                        const creator = creators.find(
                                            (c) =>
                                                String(c.id) ===
                                                String(r.creatorId),
                                        );
                                        const isMine =
                                            String(r.creatorId) ===
                                            String(userId);
                                        const creatorName = isMine
                                            ? (t("me") ?? "我")
                                            : (creator?.name ??
                                              "unknown-user");
                                        return (
                                            // biome-ignore lint/a11y/useKeyWithClickEvents: reminder item
                                            // biome-ignore lint/a11y/noStaticElementInteractions: reminder item
                                            <div
                                                key={r.id}
                                                className={cn(
                                                    "flex items-center px-4 py-4 cursor-pointer hover:bg-muted/60 transition-colors",
                                                    done && "opacity-50",
                                                )}
                                                onClick={() =>
                                                    editReminder(r.id)
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateReminder(r.id, {
                                                            ...r,
                                                            done: !r.done,
                                                        } as any);
                                                    }}
                                                    className="rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center"
                                                >
                                                    <i
                                                        className={cn(
                                                            "size-6",
                                                            done
                                                                ? "icon-[mdi--check-circle] text-emerald-500"
                                                                : r.priority ===
                                                                    "important"
                                                                  ? "icon-[mdi--alert-circle] text-rose-500"
                                                                  : "icon-[mdi--calendar-clock-outline] text-amber-500",
                                                        )}
                                                    />
                                                </button>
                                                <div className="flex-1 min-w-0 flex flex-col px-4 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "text-md font-semibold truncate h-6 flex items-center",
                                                            done &&
                                                                "line-through",
                                                        )}
                                                    >
                                                        {r.title}
                                                    </div>
                                                    <div className="flex text-xs">
                                                        <div>
                                                            {creatorName}
                                                        </div>
                                                        {r.comment && (
                                                            <>
                                                                <div className="px-1">
                                                                    |
                                                                </div>
                                                                <div className="truncate">
                                                                    {r.comment}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex-shrink-0">
                                                    {dayjs(r.time).format(
                                                        "HH:mm",
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeReminder(r.id);
                                                    }}
                                                    className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                >
                                                    <i className="icon-[mdi--trash-can-outline] size-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="mx-2 text-xs text-center text-muted-foreground/60 py-3 border rounded-md border-dashed">
                                    {t("no-reminders-today") ??
                                        "今日暫無提醒"}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="px-2 pt-2 pb-1 flex items-center justify-between flex-shrink-0">
                        <h3 className="font-semibold text-base flex items-center gap-1.5">
                            <i className="icon-[mdi--receipt-text-outline] size-4 text-primary/80" />
                            {t("transactions") ?? "交易記錄"}
                        </h3>
                        {!expandedView && (
                            <span className="text-xs text-muted-foreground">
                                {currentDateBills.length} {t("item") ?? "筆"}
                            </span>
                        )}
                    </div>
                    {expandedView ? (
                        <div className="flex-1 overflow-hidden">
                            {bills.length > 0 ? (
                                <Ledger
                                    ref={ledgerRef}
                                    bills={bills}
                                    className="relative"
                                    enableDivideAsOrdered
                                    showTime
                                    onItemShow={onItemShow}
                                    onVisibleDateChange={setCurrentDate}
                                    onDateClick={onDateClick}
                                    showAssets={showAssets}
                                />
                            ) : (
                                <div className="text-sm p-12 text-center text-muted-foreground/60">
                                    {t("nothing-here-add-one-bill")}
                                </div>
                            )}
                        </div>
                    ) : currentDateBills.length > 0 ? (
                        <div className="flex flex-col divide-y pb-24">
                            {currentDateBills.map((bill) => (
                                <BillItem
                                    key={bill.id}
                                    bill={bill}
                                    showTime
                                    showAssets={showAssets}
                                    onClick={() => showBillInfo(bill)}
                                    onDelete={() =>
                                        useLedgerStore
                                            .getState()
                                            .removeBill(bill.id)
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm p-12 text-center text-muted-foreground/60">
                            {t("nothing-here-add-one-bill")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
