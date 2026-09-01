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
import { useViewStore } from "@/store/view";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { denseDate } from "@/utils/time";

// 滑動時內容跟著手指位移，放手才真正換日，讓手勢有即時回饋
/** 超過這個位移量放手才切換日期 */
const SWIPE_COMMIT = 60;
/** 跟手位移的上限，避免整頁被拉走 */
const SWIPE_MAX = 72;

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
                : "icon-[mdi--cloud-remove-outline] text-destructive";
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [expandedView, setExpandedView] = useState(false);
    const ledgerRef = useRef<any>(null);

    // --- Day navigation ---
    /**
     * 切換日期的方向，用來決定進場動畫從哪一側滑入；
     * seq 每次切換都遞增，作為動畫容器的 key 讓動畫可以重播
     */
    const [daySwitch, setDaySwitch] = useState<{
        dir: "next" | "prev";
        seq: number;
    }>({ dir: "next", seq: 0 });
    /** 切到指定日期；方向由前後關係推得，同一天則不動作（動畫也不重播） */
    const switchDay = useCallback(
        (target: dayjs.Dayjs) => {
            if (target.isSame(currentDate, "day")) {
                return;
            }
            setDaySwitch((prev) => ({
                dir: target.isAfter(currentDate, "day") ? "next" : "prev",
                seq: prev.seq + 1,
            }));
            setCurrentDate(target);
        },
        [currentDate],
    );
    const goToPrevDay = useCallback(
        () => switchDay(currentDate.subtract(1, "day")),
        [switchDay, currentDate],
    );
    const goToNextDay = useCallback(() => {
        const next = currentDate.add(1, "day");
        if (next.isAfter(dayjs(), "day")) {
            return;
        }
        switchDay(next);
    }, [switchDay, currentDate]);
    const goToToday = useCallback(() => switchDay(dayjs()), [switchDay]);

    // --- Touch swipe support for day switching ---
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const swipeLocked = useRef(false);
    const billListRef = useRef<HTMLDivElement>(null);
    const swipeRef = useRef<HTMLDivElement>(null);
    const isTodayRef = useRef(true);

    const setSwipeOffset = useCallback((px: number) => {
        swipeRef.current?.style.setProperty("--swipe-x", `${px}px`);
    }, []);
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        swipeLocked.current = false;
        swipeRef.current?.classList.remove("day-swipe-settling");
    }, []);
    const onTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) {
                return;
            }
            const dx = e.touches[0].clientX - touchStartX.current;
            const dy = e.touches[0].clientY - touchStartY.current;
            if (!swipeLocked.current) {
                // 還沒判定方向前，等到位移足夠再決定這是橫向手勢
                if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
                    return;
                }
                if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
                    // 判定為垂直滾動，這一輪不再處理
                    touchStartX.current = null;
                    touchStartY.current = null;
                    return;
                }
                swipeLocked.current = true;
            }
            // 已經是今天時往左滑（看未來）給更強阻尼，暗示滑不過去
            const damping = dx < 0 && isTodayRef.current ? 0.18 : 0.5;
            const offset = Math.max(
                -SWIPE_MAX,
                Math.min(SWIPE_MAX, dx * damping),
            );
            setSwipeOffset(offset);
        },
        [setSwipeOffset],
    );
    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            const startX = touchStartX.current;
            const startY = touchStartY.current;
            touchStartX.current = null;
            touchStartY.current = null;
            swipeRef.current?.classList.add("day-swipe-settling");
            setSwipeOffset(0);
            if (startX === null || startY === null) {
                return;
            }
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (
                Math.abs(dx) > SWIPE_COMMIT &&
                Math.abs(dx) > Math.abs(dy) * 1.5
            ) {
                if (dx > 0) goToPrevDay();
                else goToNextDay();
            }
        },
        [goToPrevDay, goToNextDay, setSwipeOffset],
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
    // 供 touchmove 判斷「已經是今天，不能再往未來滑」
    isTodayRef.current = isToday;

    /**
     * 把目前檢視的日期同步給全域，讓導覽列的記帳按鈕能預設帶入這一天
     * 離開首頁時清掉，其他頁面的記帳仍然以今天為準
     */
    useEffect(() => {
        useViewStore
            .getState()
            .setViewingDate(currentDate.startOf("day").valueOf());
        return () => {
            useViewStore.getState().setViewingDate(undefined);
        };
    }, [currentDate]);

    /** 進場動畫的 class；每次換日都換 key 讓動畫重播 */
    const dayAnimClass =
        daySwitch.dir === "next" ? "animate-day-next" : "animate-day-prev";

    /** 當地語言的星期簡寫 */
    const weekdayLabel = useMemo(
        () =>
            currentDate
                .toDate()
                .toLocaleDateString(undefined, { weekday: "short" }),
        [currentDate],
    );

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
    const {
        reminders,
        add: addReminder,
        update: updateReminder,
        remove: removeReminder,
    } = useReminders();
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
            <div className="flex flex-wrap flex-col w-full gap-2.5">
                {/* ── Date navigation header ── */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1">
                        {currentBook && (
                            <button
                                type="button"
                                className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 hover:text-foreground transition-colors"
                                onClick={() => showBookGuide()}
                            >
                                <i className="icon-[mdi--book] size-3.5"></i>
                                {currentBook.name}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <HintTooltip
                            persistKey={"cloudSyncHintShows"}
                            content={
                                "点击可同步：先上传本机改动，再拉取其他设备的最新账单数据"
                            }
                        >
                            <button
                                type="button"
                                className="cursor-pointer flex items-center p-1"
                                onClick={() =>
                                    StorageAPI.toSync({ pull: true })
                                }
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
                <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 flex items-center surface px-1 py-1">
                        <button
                            type="button"
                            onClick={goToPrevDay}
                            className="p-1.5 rounded-full hover:bg-muted active:scale-90 transition-all cursor-pointer"
                        >
                            <i className="icon-[mdi--chevron-left] size-5"></i>
                        </button>
                        <button
                            type="button"
                            onClick={goToToday}
                            className="flex-1 flex flex-col items-center justify-center leading-tight cursor-pointer"
                        >
                            <span
                                key={daySwitch.seq}
                                className={cn(
                                    "text-[15px] font-semibold tnum animate-day-label",
                                    isToday && "text-primary",
                                )}
                            >
                                {isToday
                                    ? (t("today") ?? "今日")
                                    : denseDate(currentDate)}
                            </span>
                            <span className="text-[10px] text-muted-foreground tnum">
                                {currentDate.format("YYYY/MM/DD")}
                                {" · "}
                                {weekdayLabel}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={goToNextDay}
                            className={cn(
                                "p-1.5 rounded-full hover:bg-muted active:scale-90 transition-all cursor-pointer",
                                isToday && "opacity-25 pointer-events-none",
                            )}
                        >
                            <i className="icon-[mdi--chevron-right] size-5"></i>
                        </button>
                    </div>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="size-9 flex items-center justify-center surface hover:bg-muted transition-colors cursor-pointer"
                            >
                                <i className="icon-[mdi--calendar-month-outline] size-[18px]"></i>
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
                                selected={currentDate}
                                onDateClick={(date) => {
                                    switchDay(date);
                                    setCalendarOpen(false);
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                    <button
                        type="button"
                        onClick={() => setExpandedView((v) => !v)}
                        className={cn(
                            "size-9 flex items-center justify-center surface hover:bg-muted transition-colors cursor-pointer",
                            expandedView &&
                                "bg-primary text-primary-foreground border-primary",
                        )}
                        title={expandedView ? "收合" : "展開全部"}
                    >
                        <i
                            className={cn(
                                "size-[18px]",
                                expandedView
                                    ? "icon-[mdi--view-day-outline]"
                                    : "icon-[mdi--view-list-outline]",
                            )}
                        ></i>
                    </button>
                </div>
                {/* ── Day summary: 支出 / 收入 / 結餘 ── */}
                <div
                    key={`summary-${daySwitch.seq}`}
                    className={cn(
                        "mx-1 surface animate-day-flash overflow-hidden",
                        dayAnimClass,
                    )}
                >
                    <div className="grid grid-cols-2 divide-x divide-border">
                        <div className="flex flex-col gap-1 px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-semantic-expense"></span>
                                {t("expense")}
                            </div>
                            <div className="text-[22px] font-semibold tnum text-semantic-expense-strong">
                                <Money value={todayExpense} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-semantic-income"></span>
                                {t("income")}
                            </div>
                            <div className="text-[22px] font-semibold tnum text-semantic-income-strong">
                                <Money value={todayIncome} />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2">
                        <span className="text-[11px] text-muted-foreground">
                            {t("Balance")}
                        </span>
                        <AnimatedNumber
                            value={balance}
                            className={cn(
                                "text-sm font-semibold tnum inline-flex",
                                balance < 0
                                    ? "text-semantic-expense-strong"
                                    : balance > 0
                                      ? "text-semantic-income-strong"
                                      : "text-muted-foreground",
                            )}
                        />
                    </div>
                </div>
                {!isToday && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={goToToday}
                            className="animate-content-show text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 transition-colors cursor-pointer"
                        >
                            <i className="icon-[mdi--restore] size-3.5" />
                            {t("today") ?? "今日"}
                        </button>
                    </div>
                )}
                {/* ── Creator filter ── */}
                {creators.length > 1 && (
                    <div className="w-full px-1 flex gap-1.5 items-center overflow-x-auto scrollbar-hidden">
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                            <i className="icon-[mdi--account-filter-outline] size-4 align-middle" />
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedCreatorIds(new Set())}
                            className={cn(
                                "flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors border cursor-pointer",
                                isAllCreatorsSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-muted-foreground border-border hover:text-foreground",
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
                                        "flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors border cursor-pointer",
                                        selected
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-card text-muted-foreground border-border hover:text-foreground",
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
                            className="w-full flex overflow-x-auto gap-2 px-1 scrollbar-hidden snap-mandatory snap-x"
                        >
                            {homeWidgets.map((widget) => (
                                <div
                                    key={widget.id}
                                    className="flex-shrink-0 snap-start w-full min-h-[100px] surface overflow-hidden"
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
                onTouchMove={expandedView ? undefined : onTouchMove}
                onTouchEnd={expandedView ? undefined : onTouchEnd}
            >
                <div
                    ref={swipeRef}
                    className={cn(
                        "w-full h-full overflow-y-auto flex flex-col",
                        !expandedView && "day-swipe",
                    )}
                >
                    {/* ── Reminders section (on top) ── */}
                    {!expandedView && (
                        <div className="pt-1 pb-2 flex flex-col gap-1.5 flex-shrink-0">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="section-title flex items-center gap-1.5">
                                    <i className="icon-[mdi--bell-outline] size-3.5 text-amber-500" />
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
                                <div
                                    key={`reminders-${daySwitch.seq}`}
                                    className={cn(
                                        "mx-1 surface flex flex-col divide-y divide-border overflow-hidden",
                                        dayAnimClass,
                                    )}
                                >
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
                                            : (creator?.name ?? "unknown-user");
                                        return (
                                            // biome-ignore lint/a11y/useKeyWithClickEvents: reminder item
                                            // biome-ignore lint/a11y/noStaticElementInteractions: reminder item
                                            <div
                                                key={r.id}
                                                className={cn(
                                                    "flex items-center px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
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
                                                    className="rounded-full size-9 flex-shrink-0 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                                                >
                                                    <i
                                                        className={cn(
                                                            "size-[22px]",
                                                            done
                                                                ? "icon-[mdi--check-circle] text-semantic-income"
                                                                : r.priority ===
                                                                    "important"
                                                                  ? "icon-[mdi--alert-circle] text-semantic-expense"
                                                                  : "icon-[mdi--calendar-clock-outline] text-amber-500",
                                                        )}
                                                    />
                                                </button>
                                                <div className="flex-1 min-w-0 flex flex-col px-3 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "text-sm font-semibold truncate flex items-center",
                                                            done &&
                                                                "line-through",
                                                        )}
                                                    >
                                                        {r.title}
                                                    </div>
                                                    <div className="flex text-[11px] text-muted-foreground">
                                                        <div>{creatorName}</div>
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
                                                <div className="text-[11px] text-muted-foreground flex-shrink-0 tnum">
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
                                <div
                                    key={`reminders-empty-${daySwitch.seq}`}
                                    className={cn(
                                        "mx-1 text-[11px] text-center text-muted-foreground/70 py-3 border border-dashed border-border rounded-[var(--radius)]",
                                        dayAnimClass,
                                    )}
                                >
                                    {t("no-reminders-today") ?? "今日暫無提醒"}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="px-2 pt-2 pb-1.5 flex items-center justify-between flex-shrink-0">
                        <h3 className="section-title flex items-center gap-1.5">
                            <i className="icon-[mdi--receipt-text-outline] size-3.5 text-primary" />
                            {t("transactions") ?? "交易記錄"}
                        </h3>
                        {!expandedView && (
                            <span className="text-[11px] text-muted-foreground tnum">
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
                        <div
                            key={`bills-${daySwitch.seq}`}
                            className={cn(
                                "mx-1 mb-24 surface flex flex-col divide-y divide-border overflow-hidden",
                                dayAnimClass,
                            )}
                        >
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
                        <div
                            key={`bills-empty-${daySwitch.seq}`}
                            className={cn(
                                "mx-1 flex flex-col items-center gap-2 py-10 text-sm text-center text-muted-foreground/70",
                                dayAnimClass,
                            )}
                        >
                            <i className="icon-[mdi--notebook-outline] size-8 opacity-40" />
                            {t("nothing-here-add-one-bill")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
